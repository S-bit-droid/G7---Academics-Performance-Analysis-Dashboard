"use server";

import { readSheet } from "read-excel-file/node";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireTeacher } from "@/lib/teacher-access";
import { readAttendanceSheet } from "@/lib/google-sheet";
import { parseAttendanceCsv, parseAttendanceRows, parseMarksRows, type Row } from "@/lib/imports";

function fail(message: string): never {
  redirect(`/dashboard/import?error=${encodeURIComponent(message)}`);
}

async function teacherAssignment(id: string) {
  const teacher = await requireTeacher();
  const assignment = await getDb().teachingAssignment.findFirst({
    where: { id, teacherId: teacher.teacherId },
    include: { subject: true, sources: { where: { active: true }, take: 1 } },
  });
  if (!assignment) fail("This teaching group is not assigned to you.");
  return { assignment, actorAuthId: teacher.authUserId };
}

async function workbook(formData: FormData): Promise<Row[]> {
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) fail("Choose an .xlsx workbook.");
  if (file.size < 1 || file.size > 2 * 1024 * 1024) fail("Workbook must be between 1 byte and 2 MB.");
  try {
    return await readSheet(Buffer.from(await file.arrayBuffer())) as Row[];
  } catch {
    fail("The workbook could not be read. Check that it is a valid .xlsx file.");
  }
}

async function roster(assignment: { subjectId: string; termId: string; section: string }) {
  const enrolled = await getDb().enrolment.findMany({
    where: { subjectId: assignment.subjectId, termId: assignment.termId, section: assignment.section },
    include: { student: true },
  });
  return new Map(enrolled.map(({ student }) => [`${student.facultyNo}|${student.enrolmentNo}`, student.id]));
}

export async function uploadMarks(formData: FormData) {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const { assignment, actorAuthId } = await teacherAssignment(assignmentId);
  const parsed = parseMarksRows(await workbook(formData), assignment.subject.sessionalMax, assignment.subject.combinedRule);
  const students = await roster(assignment);
  const unmapped = parsed.accepted.filter((row) => !students.has(`${row.facultyNo}|${row.enrolmentNo}`));
  if (!parsed.accepted.length || parsed.issues.length || parsed.discrepancies.length || unmapped.length) {
    fail(`Marks upload needs correction: ${parsed.issues.length} invalid row(s), ${parsed.discrepancies.length} total mismatch(es), ${unmapped.length} unmatched student(s). No records were changed.`);
  }
  const db = getDb();
  await db.$transaction(async (tx) => {
    const previous = await tx.importBatch.findFirst({ where: { assignmentId, kind: "MARKS" }, orderBy: { version: "desc" } });
    const version = (previous?.version ?? 0) + 1;
    const batch = await tx.importBatch.create({ data: { assignmentId, kind: "MARKS", sourceName: String((formData.get("file") as File).name), actorAuthId, version, summary: { accepted: parsed.accepted.length, issues: 0 } } });
    await tx.mark.createMany({ data: parsed.accepted.map((row) => ({
      studentId: students.get(`${row.facultyNo}|${row.enrolmentNo}`)!,
      subjectId: assignment.subjectId,
      termId: assignment.termId,
      sessional1: row.sessional1,
      sessional2: row.sessional2,
      importedTotal: row.importedTotal,
      batchId: batch.id,
      version,
    })) });
  });
  revalidatePath("/dashboard/import");
  redirect("/dashboard/import?ok=marks-draft");
}

export async function selectAttendanceSource(formData: FormData) {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const { assignment } = await teacherAssignment(assignmentId);
  if (kind !== "CSV" && kind !== "GOOGLE_SHEET") fail("Choose a valid attendance source.");
  const sheetId = String(formData.get("sheetId") ?? "").trim();
  const sheetTab = String(formData.get("sheetTab") ?? "").trim();
  if (kind === "GOOGLE_SHEET" && (!/^[A-Za-z0-9_-]{15,}$/.test(sheetId) || !sheetTab)) fail("Enter the authorised Sheet ID and tab name.");
  if (assignment.sources[0]?.kind === kind && (kind !== "GOOGLE_SHEET" || (assignment.sources[0].sheetId === sheetId && assignment.sources[0].sheetTab === sheetTab))) redirect("/dashboard/import?ok=source-unchanged");
  await getDb().$transaction(async (tx) => {
    await tx.attendanceSource.updateMany({ where: { assignmentId, active: true }, data: { active: false } });
    await tx.attendanceSource.create({ data: { assignmentId, kind, sheetId: kind === "GOOGLE_SHEET" ? sheetId : null, sheetTab: kind === "GOOGLE_SHEET" ? sheetTab : null } });
  });
  revalidatePath("/dashboard/import");
  redirect("/dashboard/import?ok=source-selected");
}

export async function uploadAttendance(formData: FormData) {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const { assignment, actorAuthId } = await teacherAssignment(assignmentId);
  const source = assignment.sources[0];
  if (!source || source.kind !== "CSV") fail("Select CSV as the active attendance source first.");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) fail("Choose an attendance .csv file.");
  if (file.size < 1 || file.size > 2 * 1024 * 1024) fail("CSV must be between 1 byte and 2 MB.");
  const parsed = parseAttendanceCsv(await file.text());
  const students = await roster(assignment);
  const unmapped = parsed.accepted.filter((row) => !students.has(`${row.facultyNo}|${row.enrolmentNo}`));
  if (!parsed.accepted.length || parsed.issues.length || unmapped.length) {
    fail(`Attendance upload needs correction: ${parsed.issues.length} invalid value(s), ${unmapped.length} unmatched student(s). No records were changed.`);
  }
  const db = getDb();
  await db.$transaction(async (tx) => {
    const previous = await tx.importBatch.findFirst({ where: { assignmentId, kind: "ATTENDANCE" }, orderBy: { version: "desc" } });
    const version = (previous?.version ?? 0) + 1;
    const batch = await tx.importBatch.create({ data: { assignmentId, kind: "ATTENDANCE", sourceName: String((formData.get("file") as File).name), actorAuthId, version, summary: { accepted: parsed.accepted.length, issues: 0 } } });
    await tx.attendanceRecord.createMany({ data: parsed.accepted.map((row) => ({
      studentId: students.get(`${row.facultyNo}|${row.enrolmentNo}`)!,
      subjectId: assignment.subjectId,
      termId: assignment.termId,
      sessionOn: new Date(`${row.sessionOn}T00:00:00Z`),
      sessionNo: row.sessionNo,
      status: row.status,
      sourceId: source.id,
      batchId: batch.id,
      version,
    })) });
    await tx.attendanceSource.update({ where: { id: source.id }, data: { lastSuccess: new Date(), lastError: null } });
  });
  revalidatePath("/dashboard/import");
  redirect("/dashboard/import?ok=attendance-draft");
}

export async function syncSheetAttendance(formData: FormData) {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const { assignment, actorAuthId } = await teacherAssignment(assignmentId);
  const source = assignment.sources[0];
  if (!source || source.kind !== "GOOGLE_SHEET" || !source.sheetId || !source.sheetTab) fail("Select a linked Google Sheet first.");
  let rows: Row[];
  try {
    rows = await readAttendanceSheet(source.sheetId, source.sheetTab);
  } catch (error) {
    await getDb().attendanceSource.update({ where: { id: source.id }, data: { lastError: error instanceof Error ? error.message.slice(0, 200) : "Sheet read failed" } });
    fail("Sheet read failed. The last valid attendance remains available.");
  }
  const parsed = parseAttendanceRows(rows);
  const students = await roster(assignment);
  const unmapped = parsed.accepted.filter((row) => !students.has(`${row.facultyNo}|${row.enrolmentNo}`));
  if (!parsed.accepted.length || parsed.issues.length || unmapped.length) {
    await getDb().attendanceSource.update({ where: { id: source.id }, data: { lastError: "Sheet rows failed validation" } });
    fail(`Sheet needs correction: ${parsed.issues.length} invalid value(s), ${unmapped.length} unmatched student(s). Previous records remain available.`);
  }
  const hash = createHash("sha256").update(JSON.stringify(parsed.accepted)).digest("hex");
  const db = getDb();
  const latest = await db.importBatch.findFirst({ where: { assignmentId, kind: "ATTENDANCE", sourceName: `sheet:${source.id}` }, orderBy: { version: "desc" } });
  if (latest && typeof latest.summary === "object" && latest.summary && !Array.isArray(latest.summary) && latest.summary.hash === hash) {
    await db.attendanceSource.update({ where: { id: source.id }, data: { lastSuccess: new Date(), lastError: null } });
    redirect("/dashboard/import?ok=source-unchanged");
  }
  await db.$transaction(async (tx) => {
    const previous = await tx.importBatch.findFirst({ where: { assignmentId, kind: "ATTENDANCE" }, orderBy: { version: "desc" } });
    const version = (previous?.version ?? 0) + 1;
    const batch = await tx.importBatch.create({ data: { assignmentId, kind: "ATTENDANCE", sourceName: `sheet:${source.id}`, actorAuthId, version, summary: { accepted: parsed.accepted.length, hash } } });
    await tx.attendanceRecord.createMany({ data: parsed.accepted.map((row) => ({
      studentId: students.get(`${row.facultyNo}|${row.enrolmentNo}`)!,
      subjectId: assignment.subjectId,
      termId: assignment.termId,
      sessionOn: new Date(`${row.sessionOn}T00:00:00Z`),
      sessionNo: row.sessionNo,
      status: row.status,
      sourceId: source.id,
      batchId: batch.id,
      version,
    })) });
    await tx.attendanceSource.update({ where: { id: source.id }, data: { lastSuccess: new Date(), lastError: null } });
  });
  revalidatePath("/dashboard/import");
  redirect("/dashboard/import?ok=attendance-draft");
}

export async function releaseBatch(formData: FormData) {
  const batchId = String(formData.get("batchId") ?? "");
  const batch = await getDb().importBatch.findUnique({ where: { id: batchId }, include: { assignment: true } });
  if (!batch) fail("Draft batch not found.");
  await teacherAssignment(batch.assignmentId);
  if (batch.status !== "DRAFT") fail("Only a draft can be released.");
  const db = getDb();
  await db.$transaction(async (tx) => {
    if (batch.kind === "MARKS") {
      const rows = await tx.mark.findMany({ where: { batchId }, select: { studentId: true } });
      await tx.mark.updateMany({ where: { studentId: { in: rows.map((row) => row.studentId) }, subjectId: batch.assignment.subjectId, termId: batch.assignment.termId, status: "RELEASED" }, data: { status: "SUPERSEDED" } });
      await tx.mark.updateMany({ where: { batchId, status: "DRAFT" }, data: { status: "RELEASED", releasedAt: new Date() } });
    } else if (batch.kind === "ATTENDANCE") {
      const rows = await tx.attendanceRecord.findMany({ where: { batchId }, select: { studentId: true, sessionOn: true, sessionNo: true, sourceId: true } });
      const activeSource = await tx.attendanceSource.findFirst({ where: { assignmentId: batch.assignmentId, active: true } });
      if (!activeSource || rows.some((row) => row.sourceId !== activeSource.id)) throw new Error("Attendance source changed after the draft was created.");
      const bySession = new Map<string, string[]>();
      for (const row of rows) {
        const key = `${row.sessionOn.toISOString().slice(0, 10)}#${row.sessionNo}`;
        bySession.set(key, [...(bySession.get(key) ?? []), row.studentId]);
      }
      for (const [key, studentIds] of bySession) {
        const [date, session] = key.split("#");
        await tx.attendanceRecord.updateMany({ where: { studentId: { in: studentIds }, subjectId: batch.assignment.subjectId, termId: batch.assignment.termId, sessionOn: new Date(`${date}T00:00:00Z`), sessionNo: Number(session), recordStatus: "RELEASED" }, data: { recordStatus: "SUPERSEDED" } });
      }
      await tx.attendanceRecord.updateMany({ where: { batchId, recordStatus: "DRAFT" }, data: { recordStatus: "RELEASED", releasedAt: new Date() } });
    } else fail("Unknown batch kind.");
    await tx.importBatch.update({ where: { id: batchId }, data: { status: "RELEASED", releasedAt: new Date() } });
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/import");
  redirect("/dashboard/import?ok=released");
}
