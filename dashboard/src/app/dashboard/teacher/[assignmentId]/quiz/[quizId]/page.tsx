import Link from "next/link";
import { notFound } from "next/navigation";
import { formatAcademicTime } from "@/lib/academic-time";
import { getDb } from "@/lib/db";
import { attendanceAttemptLabel, latestAttendanceByStudent } from "@/lib/quiz-review";
import { requireTeachingGroup } from "@/lib/teacher-access";

export const dynamic = "force-dynamic";

export default async function QuizReviewPage({ params }: { params: Promise<{ assignmentId: string; quizId: string }> }) {
  const { assignmentId, quizId } = await params;
  const { teacher, group } = await requireTeachingGroup(assignmentId);
  const db = getDb();
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, teacherId: teacher.teacherId, subjectId: group.subjectId, termId: group.termId, section: group.section },
    include: { attempts: { include: { activityEvents: { orderBy: { receivedAt: "asc" } } } } },
  });
  if (!quiz) notFound();
  const [enrolments, attendance] = await Promise.all([
    db.enrolment.findMany({ where: { subjectId: group.subjectId, termId: group.termId, section: group.section }, include: { student: true }, orderBy: { student: { name: "asc" } } }),
    quiz.attendanceOn ? db.attendanceRecord.findMany({ where: {
      subjectId: group.subjectId, termId: group.termId, sessionOn: quiz.attendanceOn,
      sessionNo: quiz.attendanceSessionNo ?? 1,
      recordStatus: "RELEASED", source: { assignment: {
        subjectId: group.subjectId, termId: group.termId, section: group.section,
      } },
    }, orderBy: { releasedAt: "desc" } }) : Promise.resolve([]),
  ]);
  const latest = latestAttendanceByStudent(attendance);
  const attempts = new Map(quiz.attempts.map((attempt) => [attempt.studentId, attempt]));
  const now = new Date().getTime();
  const rows = enrolments.map(({ student }) => {
    const attempt = attempts.get(student.id);
    const status = latest.get(student.id)?.status ?? null;
    const events = attempt?.activityEvents ?? [];
    const interruptions = events.filter((event) => event.type === "HIDDEN" || event.type === "EXIT" || event.type === "CONTACT_GAP");
    const noRecentContact = Boolean(attempt && !attempt.submittedAt && now - (attempt.lastSeenAt ?? attempt.startedAt).getTime() >= 45_000);
    const timerExpired = Boolean(attempt && !attempt.submittedAt && now > attempt.startedAt.getTime() + quiz.timerSeconds * 1000);
    return { student, attempt, status, events, interruptions, noRecentContact, timerExpired };
  });
  const presentWithoutAttempt = rows.filter((row) => row.status === "PRESENT" && !row.attempt).length;
  const absentWithAttempt = rows.filter((row) => row.status === "ABSENT" && row.attempt).length;
  const activityToReview = rows.filter((row) => row.interruptions.length || row.noRecentContact).length;
  return <main className="min-h-screen bg-[#0a1220] px-6 py-8 text-slate-100"><div className="mx-auto max-w-6xl">
    <Link href={`/dashboard/teacher/${assignmentId}`} className="text-sm text-cyan-300">← {group.subject.name}</Link>
    <h1 className="mt-6 text-3xl font-semibold">Quiz review: {quiz.title}</h1>
    <p className="mt-2 text-sm text-slate-400">Section {group.section} · Attendance {quiz.attendanceOn?.toISOString().slice(0, 10) ?? "not linked"}, session {quiz.attendanceSessionNo ?? 1}</p>
    <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">This compares attempts with released attendance for the selected class date and session. A plain date column means session 1; later sessions use a suffix such as #2. Page activity and contact gaps are review signals, not proof of cheating.</p>
    <div className="mt-7 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-white/10 bg-[#101e30] p-4"><p className="text-xs text-slate-400">Present, no attempt</p><p className="mt-2 text-2xl font-semibold">{presentWithoutAttempt}</p></div>
      <div className="rounded-xl border border-white/10 bg-[#101e30] p-4"><p className="text-xs text-slate-400">Absent, attempted</p><p className="mt-2 text-2xl font-semibold">{absentWithAttempt}</p></div>
      <div className="rounded-xl border border-white/10 bg-[#101e30] p-4"><p className="text-xs text-slate-400">Page or contact activity to review</p><p className="mt-2 text-2xl font-semibold">{activityToReview}</p></div>
    </div>
    <section className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-xl font-semibold">Student comparison</h2>
      {rows.length === 0 ? <p className="mt-4 text-sm text-slate-400">No Students are enrolled in this class.</p> : <table className="mt-5 w-full min-w-[780px] text-left text-sm"><thead className="text-slate-400"><tr><th className="pb-3">Student</th><th className="pb-3">Attendance</th><th className="pb-3">Quiz attempt</th><th className="pb-3">Activity</th></tr></thead><tbody>{rows.map(({ student, attempt, status, events, interruptions, noRecentContact, timerExpired }) => <tr key={student.id} className="border-t border-white/10 align-top">
        <td className="py-4 pr-4"><p className="font-medium">{student.name}</p><p className="text-xs text-slate-400">{student.facultyNo}</p></td>
        <td className="py-4 pr-4"><p>{status ?? "Not available"}</p><p className="mt-1 text-xs text-slate-400">{attendanceAttemptLabel(status, Boolean(attempt))}</p></td>
        <td className="py-4 pr-4">{!attempt ? "Not started" : attempt.submittedAt ? <><p>{attempt.timedOut ? "Timed out" : "Submitted"} · {attempt.score ?? 0} points</p><p className="mt-1 text-xs text-slate-400">{formatAcademicTime(attempt.submittedAt)}</p></> : <><p>{timerExpired ? "Timer expired · no submission" : "Started · not submitted"}</p><p className="mt-1 text-xs text-slate-400">{formatAcademicTime(attempt.startedAt)}</p></>}</td>
        <td className="py-4">{!attempt ? "No attempt" : <><p>{interruptions.length ? `${interruptions.length} event(s) to review` : "No interruption signal received"}</p>{noRecentContact && <p className="mt-1 text-xs text-amber-300">No recent server contact</p>}<p className="mt-1 text-xs text-slate-400">Last contact: {attempt.lastSeenAt ? formatAcademicTime(attempt.lastSeenAt) : "not recorded"}</p>{events.length > 0 && <details className="mt-2"><summary className="cursor-pointer text-xs text-cyan-300">View activity log</summary><ul className="mt-2 space-y-1 text-xs text-slate-300">{events.map((event) => <li key={event.id}>{formatAcademicTime(event.receivedAt)} · {event.type === "CONTACT_GAP" ? `Server contact gap (${event.durationSeconds ?? "?"} seconds)` : event.type === "HIDDEN" ? "Quiz page hidden" : event.type === "VISIBLE" ? "Quiz page visible" : "Page exited"}</li>)}</ul></details>}</>}</td>
      </tr>)}</tbody></table>}
    </section>
  </div></main>;
}
