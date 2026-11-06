import { combinedSessional, type CombinedRule } from "./academic";
import { tableFromCsv } from "./admin-accounts";

export type Cell = string | number | boolean | Date | null | undefined;
export type Row = Cell[];
export type ImportIssue = { row: number; message: string };
export type MarksRow = {
  row: number;
  facultyNo: string;
  enrolmentNo: string;
  name: string;
  sessional1: number | null;
  sessional2: number | null;
  importedTotal: number | null;
  expectedTotal: number | null;
};
export type AttendanceRow = {
  row: number;
  facultyNo: string;
  enrolmentNo: string;
  name: string;
  sessionOn: string;
  sessionNo: number;
  status: "PRESENT" | "ABSENT" | "UNRECORDED";
};

const normal = (value: Cell) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const text = (value: Cell) => String(value ?? "").trim();
const aliases = {
  facultyNo: ["facultyno", "facultynumber"],
  enrolmentNo: ["enrolmentno", "enrollmentno", "enrolmentnumber", "enrollmentnumber"],
  name: ["name", "studentname"],
  sessional1: ["sessional1", "sessionali"],
  sessional2: ["sessional2", "sessionalii"],
  total: ["total", "totalmarks", "totalsessionalmarks"],
};

function findHeader(rows: Row[], required: string[]) {
  for (let index = 0; index < Math.min(rows.length, 10); index++) {
    const names = rows[index].map(normal);
    const positions = Object.fromEntries(Object.entries(aliases).map(([key, choices]) => [key, names.findIndex((name) => choices.includes(name))]));
    if (required.every((key) => positions[key] >= 0)) return { index, positions };
  }
  return null;
}

function score(value: Cell, maximum: number) {
  if (value === null || value === undefined || text(value) === "") return { value: null, error: null };
  const parsed = typeof value === "number" ? value : Number(text(value));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > maximum) return { value: null, error: `Mark must be between 0 and ${maximum}` };
  return { value: parsed, error: null };
}

export function parseMarksRows(rows: Row[], maximum: number, rule: CombinedRule) {
  const header = findHeader(rows, ["facultyNo", "enrolmentNo", "name", "sessional1", "sessional2", "total"]);
  if (!header) return { accepted: [] as MarksRow[], issues: [{ row: 0, message: "Required marks columns were not found" }] as ImportIssue[], discrepancies: [] as ImportIssue[] };
  const accepted: MarksRow[] = [];
  const issues: ImportIssue[] = [];
  const discrepancies: ImportIssue[] = [];
  const seen = new Set<string>();
  for (let i = header.index + 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.every((cell) => text(cell) === "")) continue;
    const row = i + 1;
    const facultyNo = text(cells[header.positions.facultyNo]);
    const enrolmentNo = text(cells[header.positions.enrolmentNo]);
    const name = text(cells[header.positions.name]);
    if (!facultyNo || !enrolmentNo) { issues.push({ row, message: "Faculty and enrolment numbers are required" }); continue; }
    const key = `${facultyNo}|${enrolmentNo}`;
    if (seen.has(key)) { issues.push({ row, message: "Duplicate student identifiers" }); continue; }
    seen.add(key);
    const first = score(cells[header.positions.sessional1], maximum);
    const second = score(cells[header.positions.sessional2], maximum);
    const total = score(cells[header.positions.total], rule === "SUM" ? maximum * 2 : maximum);
    if (first.error || second.error || total.error) { issues.push({ row, message: [first.error, second.error, total.error].filter(Boolean).join("; ") }); continue; }
    const expectedTotal = combinedSessional(first.value, second.value, rule);
    if (total.value !== null && expectedTotal !== null && Math.abs(total.value - expectedTotal) > 0.001) discrepancies.push({ row, message: `Imported total ${total.value} differs from ${rule.toLowerCase()} result ${expectedTotal}` });
    accepted.push({ row, facultyNo, enrolmentNo, name, sessional1: first.value, sessional2: second.value, importedTotal: total.value, expectedTotal });
  }
  return { accepted, issues, discrepancies };
}

function dateCell(value: Cell): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw ? raw : null;
  }
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso ? null : iso;
}

function attendanceColumn(value: Cell) {
  const raw = text(value);
  const match = /^(.*?)(?:\s*#([1-9]|1\d|20))?$/.exec(raw);
  if (!match) return null;
  const date = dateCell(value instanceof Date ? value : match[1].trim());
  return date ? { date, sessionNo: match[2] ? Number(match[2]) : 1 } : null;
}

export function parseAttendanceRows(rows: Row[]) {
  const header = findHeader(rows, ["facultyNo", "enrolmentNo", "name"]);
  if (!header) return { accepted: [] as AttendanceRow[], issues: [{ row: 0, message: "Required attendance columns were not found" }] as ImportIssue[] };
  const reserved = new Set(Object.values(header.positions).filter((position) => position >= 0));
  const dates = rows[header.index].flatMap((value, column) => {
    const session = reserved.has(column) ? null : attendanceColumn(value);
    return session ? [{ column, ...session }] : [];
  });
  const accepted: AttendanceRow[] = [];
  const issues: ImportIssue[] = [];
  rows[header.index].forEach((value, column) => {
    if (reserved.has(column) || !text(value) || ["serialno", "serialnumber", "sno"].includes(normal(value))) return;
    if (!attendanceColumn(value)) issues.push({ row: header.index + 1, message: `Unrecognised date column: ${text(value)}` });
  });
  if (dates.length === 0) issues.push({ row: header.index + 1, message: "No valid date columns found" });
  const uniqueDates = new Set<string>();
  for (const item of dates) {
    const key = `${item.date}#${item.sessionNo}`;
    if (uniqueDates.has(key)) issues.push({ row: header.index + 1, message: `Duplicate date and session column: ${key}` });
    uniqueDates.add(key);
  }
  const seen = new Set<string>();
  for (let i = header.index + 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.every((cell) => text(cell) === "")) continue;
    const row = i + 1;
    const facultyNo = text(cells[header.positions.facultyNo]);
    const enrolmentNo = text(cells[header.positions.enrolmentNo]);
    const name = text(cells[header.positions.name]);
    if (!facultyNo || !enrolmentNo) { issues.push({ row, message: "Faculty and enrolment numbers are required" }); continue; }
    const key = `${facultyNo}|${enrolmentNo}`;
    if (seen.has(key)) { issues.push({ row, message: "Duplicate student identifiers" }); continue; }
    seen.add(key);
    for (const { column, date, sessionNo } of dates) {
      const value = normal(cells[column]);
      if (!value) {
        accepted.push({ row, facultyNo, enrolmentNo, name, sessionOn: date, sessionNo, status: "UNRECORDED" });
        continue;
      }
      if (value !== "p" && value !== "present" && value !== "a" && value !== "absent") { issues.push({ row, message: `Unrecognised attendance value for ${date}` }); continue; }
      accepted.push({ row, facultyNo, enrolmentNo, name, sessionOn: date, sessionNo, status: value === "p" || value === "present" ? "PRESENT" : "ABSENT" });
    }
  }
  return { accepted, issues };
}

export function parseAttendanceCsv(input: string) {
  const parsed = tableFromCsv(input);
  if (parsed.error) return { accepted: [] as AttendanceRow[], issues: [{ row: 0, message: parsed.error }] };
  if (!parsed.cells.length) return { accepted: [] as AttendanceRow[], issues: [{ row: 0, message: "The CSV is empty" }] };
  const columns = parsed.cells[0].length;
  const invalid = parsed.cells.findIndex((row) => row.length !== columns);
  if (invalid >= 0) return { accepted: [] as AttendanceRow[], issues: [{ row: parsed.lines[invalid], message: "Inconsistent CSV column count" }] };
  return parseAttendanceRows(parsed.cells);
}
