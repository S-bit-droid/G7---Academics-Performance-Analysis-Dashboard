export const accountRoles = ["STUDENT", "TEACHER", "HOD", "ADMIN"] as const;
export type AccountRole = (typeof accountRoles)[number];

export const csvHeaders: Record<AccountRole, readonly string[]> = {
  STUDENT: ["name", "email", "faculty_no", "enrolment_no", "programme_code"],
  TEACHER: ["name", "email", "department_code"],
  HOD: ["name", "email", "department_code"],
  ADMIN: ["name", "email"],
};

export type AccountInput = {
  line: number;
  name: string;
  email: string;
  facultyNo?: string;
  enrolmentNo?: string;
  programmeCode?: string;
  departmentCode?: string;
};

export type AccountParse = { rows: AccountInput[]; issues: string[] };
export const MAX_CSV_ROWS = 25;
export const MAX_CSV_BYTES = 64 * 1024;

export function isAccountRole(value: string): value is AccountRole {
  return accountRoles.includes(value as AccountRole);
}

function tableFromCsv(input: string): { cells: string[][]; lines: number[]; error?: string } {
  const text = input.replace(/^\uFEFF/, "");
  const cells: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let startLine = 1;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else { field += char; if (char === "\n") line++; }
      continue;
    }
    if (char === '"') {
      if (field.trim() || closedQuote) return { cells, lines, error: `Unexpected quote on line ${line}.` };
      quoted = true;
    } else if (char === "," || char === "\n" || char === "\r") {
      row.push(field.trim()); field = ""; closedQuote = false;
      if (char !== ",") {
        if (row.some(Boolean)) { cells.push(row); lines.push(startLine); }
        row = [];
        if (char === "\r" && text[i + 1] === "\n") i++;
        line++; startLine = line;
      }
    } else {
      if (closedQuote && !/\s/.test(char)) return { cells, lines, error: `Unexpected text after a quote on line ${line}.` };
      field += char;
    }
  }
  if (quoted) return { cells, lines, error: "The CSV ends inside a quoted field." };
  if (field || row.length) {
    row.push(field.trim());
    if (row.some(Boolean)) { cells.push(row); lines.push(startLine); }
  }
  return { cells, lines };
}

export function validateAccountRows(role: AccountRole, rows: AccountInput[]): string[] {
  const issues: string[] = [];
  const emails = new Set<string>();
  const facultyNumbers = new Set<string>();
  const enrolmentNumbers = new Set<string>();
  if (rows.length < 1) issues.push("Add at least one account.");
  if (rows.length > MAX_CSV_ROWS) issues.push(`Upload no more than ${MAX_CSV_ROWS} accounts at a time.`);
  for (const row of rows) {
    const prefix = `Line ${row.line}`;
    if (!row.name || row.name.length > 120) issues.push(`${prefix}: name is required (up to 120 characters).`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) || row.email.length > 254) issues.push(`${prefix}: enter a valid email.`);
    if (emails.has(row.email)) issues.push(`${prefix}: email is repeated in this upload.`);
    emails.add(row.email);
    if (role === "STUDENT") {
      for (const [label, value] of [["faculty_no", row.facultyNo], ["enrolment_no", row.enrolmentNo], ["programme_code", row.programmeCode]]) {
        if (!value || value.length > 64) issues.push(`${prefix}: ${label} is required (up to 64 characters).`);
      }
      if (row.facultyNo && facultyNumbers.has(row.facultyNo)) issues.push(`${prefix}: faculty_no is repeated.`);
      if (row.enrolmentNo && enrolmentNumbers.has(row.enrolmentNo)) issues.push(`${prefix}: enrolment_no is repeated.`);
      if (row.facultyNo) facultyNumbers.add(row.facultyNo);
      if (row.enrolmentNo) enrolmentNumbers.add(row.enrolmentNo);
    }
    if ((role === "TEACHER" || role === "HOD") && (!row.departmentCode || row.departmentCode.length > 64)) {
      issues.push(`${prefix}: department_code is required (up to 64 characters).`);
    }
  }
  return issues;
}

export function parseAccountCsv(text: string, role: AccountRole): AccountParse {
  const parsed = tableFromCsv(text);
  if (parsed.error) return { rows: [], issues: [parsed.error] };
  if (!parsed.cells.length) return { rows: [], issues: ["The CSV is empty."] };
  const headers = parsed.cells[0].map((value) => value.toLowerCase());
  const required = csvHeaders[role];
  const issues = required.filter((header) => !headers.includes(header)).map((header) => `Missing column: ${header}.`);
  if (new Set(headers).size !== headers.length) issues.push("CSV column names must be unique.");
  const unexpected = headers.filter((header) => !required.includes(header));
  if (unexpected.length) issues.push(`Unexpected column(s): ${unexpected.join(", ")}. Use the ${role.toLowerCase()} template.`);
  if (issues.length) return { rows: [], issues };
  const rows: AccountInput[] = [];
  for (let i = 1; i < parsed.cells.length; i++) {
    const cells = parsed.cells[i];
    if (cells.length !== headers.length) {
      issues.push(`Line ${parsed.lines[i]}: expected ${headers.length} columns, found ${cells.length}.`);
      continue;
    }
    const get = (key: string) => cells[headers.indexOf(key)] ?? "";
    rows.push({
      line: parsed.lines[i], name: get("name"), email: get("email").toLowerCase(),
      facultyNo: get("faculty_no"), enrolmentNo: get("enrolment_no"),
      programmeCode: get("programme_code"), departmentCode: get("department_code"),
    });
  }
  issues.push(...validateAccountRows(role, rows));
  return { rows, issues };
}
