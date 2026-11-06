import "server-only";
import { attendanceSummary, combinedSessional } from "@/lib/academic";
import { getDb } from "@/lib/db";

export function previousMonth(now: Date) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  return { month: start.toISOString().slice(0, 7), start, end };
}

export async function generatePreviousMonthReports(now = new Date()) {
  const { month, start, end } = previousMonth(now);
  const db = getDb();
  let created = 0;
  let cursor: string | undefined;
  while (true) {
    const students = await db.student.findMany({
      select: { id: true, name: true }, orderBy: { id: "asc" }, take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!students.length) break;
    for (const student of students) {
      const existing = await db.monthlyReport.findUnique({ where: { studentId_month: { studentId: student.id, month } }, select: { id: true } });
      if (existing) continue;
      const [enrolments, marks, attendance, attempts] = await Promise.all([
        db.enrolment.findMany({ where: { studentId: student.id }, include: { subject: true } }),
        db.mark.findMany({ where: { studentId: student.id, status: "RELEASED", releasedAt: { lt: end } }, orderBy: { updatedAt: "desc" } }),
        db.attendanceRecord.findMany({ where: { studentId: student.id, recordStatus: "RELEASED", sessionOn: { gte: start, lt: end } } }),
        db.quizAttempt.findMany({ where: { studentId: student.id, submittedAt: { gte: start, lt: end } }, include: { quiz: true } }),
      ]);
      const subjects = enrolments.map(({ subject, termId }) => {
        const mark = marks.find((row) => row.subjectId === subject.id && row.termId === termId);
        const rows = attendance.filter((row) => row.subjectId === subject.id && row.termId === termId);
        const summary = attendanceSummary(rows.map((row) => row.status), false);
        const quizResults = attempts.filter((row) => row.quiz.subjectId === subject.id && row.quiz.termId === termId).map((row) => ({ title: row.quiz.title, score: row.score, timedOut: row.timedOut }));
        return {
          subject: subject.name,
          marks: mark ? { sessional1: mark.sessional1, sessional2: mark.sessional2, combined: combinedSessional(mark.sessional1, mark.sessional2, subject.combinedRule), method: subject.combinedRule } : null,
          attendance: { attended: summary.attended, counted: summary.counted, percentage: summary.percentage },
          quizzes: quizResults,
          coverage: { marks: Boolean(mark), attendance: summary.counted > 0, quizzes: quizResults.length > 0 },
        };
      });
      await db.monthlyReport.create({ data: { studentId: student.id, month, summary: { month, studentName: student.name, subjects, generatedAt: now.toISOString() } } });
      created++;
    }
    cursor = students[students.length - 1].id;
    if (students.length < 100) break;
  }
  return { month, created };
}
