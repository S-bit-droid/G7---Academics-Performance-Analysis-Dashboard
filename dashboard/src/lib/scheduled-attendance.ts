import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { readAttendanceSheet } from "@/lib/google-sheet";
import { parseAttendanceRows } from "@/lib/imports";

export async function syncLinkedAttendance() {
  const db = getDb();
  const sources = await db.attendanceSource.findMany({
    where: { kind: "GOOGLE_SHEET", active: true },
    include: { assignment: true },
  });
  const result = { checked: sources.length, released: 0, unchanged: 0, skipped: 0, failed: 0 };
  for (const source of sources) {
    try {
      if (!source.sheetId || !source.sheetTab) throw new Error("Sheet ID or tab is missing");
      const parsed = parseAttendanceRows(await readAttendanceSheet(source.sheetId, source.sheetTab));
      if (!parsed.accepted.length || parsed.issues.length) throw new Error(`Sheet has ${parsed.issues.length} invalid row(s)`);
      const enrolments = await db.enrolment.findMany({ where: {
        subjectId: source.assignment.subjectId, termId: source.assignment.termId,
        section: source.assignment.section,
      }, include: { student: true } });
      const roster = new Map(enrolments.map(({ student }) => [`${student.facultyNo}|${student.enrolmentNo}`, student.id]));
      if (parsed.accepted.some((row) => !roster.has(`${row.facultyNo}|${row.enrolmentNo}`))) {
        throw new Error("Sheet contains a Student outside this class");
      }
      const hash = createHash("sha256").update(JSON.stringify(parsed.accepted)).digest("hex");
      const latest = await db.importBatch.findFirst({
        where: { assignmentId: source.assignmentId, kind: "ATTENDANCE", sourceName: `sheet:${source.id}` },
        orderBy: { version: "desc" },
      });
      const same = latest?.summary && typeof latest.summary === "object" && !Array.isArray(latest.summary) && latest.summary.hash === hash;
      if (same && latest?.status === "RELEASED") {
        result.unchanged++;
        await db.attendanceSource.update({ where: { id: source.id }, data: { lastSuccess: new Date(), lastError: null } });
        continue;
      }
      const pending = await db.importBatch.findFirst({ where: {
        assignmentId: source.assignmentId, kind: "ATTENDANCE", status: "DRAFT",
      }, select: { id: true } });
      if (pending) {
        result.skipped++;
        continue;
      }
      await db.$transaction(async (tx) => {
        const stillActive = await tx.attendanceSource.findFirst({ where: { id: source.id, active: true } });
        if (!stillActive) throw new Error("Attendance source changed during sync");
        const previous = await tx.importBatch.findFirst({ where: { assignmentId: source.assignmentId, kind: "ATTENDANCE" }, orderBy: { version: "desc" } });
        const now = new Date();
        const batch = await tx.importBatch.create({ data: {
          assignmentId: source.assignmentId, kind: "ATTENDANCE", sourceName: `sheet:${source.id}`,
          actorAuthId: "system:google-sheet-sync", version: (previous?.version ?? 0) + 1,
          status: "RELEASED", releasedAt: now, summary: { accepted: parsed.accepted.length, hash, scheduled: true },
        } });
        const sessions = [...new Map(parsed.accepted.map((row) => [`${row.sessionOn}#${row.sessionNo}`, { date: row.sessionOn, number: row.sessionNo }])).values()];
        await tx.attendanceRecord.updateMany({ where: {
          sourceId: source.id, subjectId: source.assignment.subjectId, termId: source.assignment.termId,
          OR: sessions.map((session) => ({ sessionOn: new Date(`${session.date}T00:00:00Z`), sessionNo: session.number })),
          recordStatus: "RELEASED",
        }, data: { recordStatus: "SUPERSEDED" } });
        await tx.attendanceRecord.createMany({ data: parsed.accepted.map((row) => ({
          studentId: roster.get(`${row.facultyNo}|${row.enrolmentNo}`)!,
          subjectId: source.assignment.subjectId, termId: source.assignment.termId,
          sessionOn: new Date(`${row.sessionOn}T00:00:00Z`), sessionNo: row.sessionNo,
          status: row.status, sourceId: source.id,
          batchId: batch.id, version: batch.version, recordStatus: "RELEASED", releasedAt: now,
        })) });
        await tx.attendanceSource.update({ where: { id: source.id }, data: { lastSuccess: now, lastError: null } });
      });
      result.released++;
    } catch (error) {
      result.failed++;
      await db.attendanceSource.update({ where: { id: source.id }, data: {
        lastError: error instanceof Error ? error.message.slice(0, 200) : "Scheduled Sheet sync failed",
      } });
    }
  }
  return result;
}
