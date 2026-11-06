import { formatAcademicTime } from "@/lib/academic-time";
import { MonthlyReportCard } from "@/app/dashboard/monthly-report-card";
import Link from "next/link";
import { attendanceSummary, combinedSessional, marksWarning } from "@/lib/academic";
import { getDb } from "@/lib/db";
import { privateFileUrl } from "@/lib/private-files";
import { requireStudent } from "@/lib/student-access";
import { addStudentWork, saveAcademicProfile, sendAcademicFeedback, startQuiz, submitAssignment, updateStudentWork } from "./actions";
import { StudentProgress, type SubjectProgress } from "./student-progress";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-lg border border-white/20 bg-[#0a1220] px-3 py-2 text-sm";

export default async function StudentWorkspace({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const student = await requireStudent();
  const db = getDb();
  const [enrolments, work, threads, reports, notices, marks, attendance] = await Promise.all([
    db.enrolment.findMany({ where: { studentId: student.id }, include: { subject: true, term: true } }),
    db.studentWork.findMany({ where: { studentId: student.id }, orderBy: { updatedAt: "desc" }, take: 30 }),
    db.questionThread.findMany({ where: { studentId: student.id }, include: { subject: true, messages: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.monthlyReport.findMany({ where: { studentId: student.id }, orderBy: { month: "desc" }, take: 12 }),
    db.notification.findMany({ where: { studentId: student.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.mark.findMany({ where: { studentId: student.id, status: "RELEASED" }, orderBy: { updatedAt: "desc" } }),
    db.attendanceRecord.findMany({ where: { studentId: student.id, recordStatus: "RELEASED" }, orderBy: { sessionOn: "desc" } }),
  ]);
  const profileIncomplete = !student.highSchool || !student.intermediate || !student.branch || (student.programme.level === "PG" && !student.bachelors);
  const progress: SubjectProgress[] = enrolments.map((row) => {
    const mark = marks.find((item) => item.subjectId === row.subjectId && item.termId === row.termId);
    const sessions = attendance.filter((item) => item.subjectId === row.subjectId && item.termId === row.termId);
    const summary = attendanceSummary(sessions.map((item) => item.status), true);
    const combined = mark ? combinedSessional(mark.sessional1, mark.sessional2, row.subject.combinedRule) : null;
    return {
      key: row.id, subject: row.subject.name, term: row.term.label,
      sessional1: mark?.sessional1 ?? null, sessional2: mark?.sessional2 ?? null,
      combined, combinedRule: row.subject.combinedRule,
      combinedMaximum: row.subject.sessionalMax * (row.subject.combinedRule === "SUM" ? 2 : 1),
      attendancePercentage: summary.percentage, attended: summary.attended, counted: summary.counted,
      marksWarning: Boolean(mark && marksWarning(student.programme.level, mark.sessional1, mark.sessional2, row.subject.sessionalMax)),
      attendanceWarning: summary.warning,
    };
  });
  const allGroups = await db.teachingAssignment.findMany({ where: { subjectId: { in: enrolments.map((row) => row.subjectId) } }, include: { teacher: true, subject: true, term: true } });
  const groups = allGroups.filter((group) => enrolments.some((row) => row.subjectId === group.subjectId && row.termId === group.termId && row.section === group.section));
  const groupIds = groups.map((group) => group.id);
  const [materials, allQuizzes, allEvents, timetables] = await Promise.all([
    db.teachingMaterial.findMany({ where: { assignmentId: { in: groupIds } }, include: { assignment: { include: { subject: true } }, submissions: { where: { studentId: student.id } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.quiz.findMany({ where: { publishedAt: { not: null }, subjectId: { in: enrolments.map((row) => row.subjectId) } }, include: { subject: true, attempts: { where: { studentId: student.id } } }, orderBy: { publishedAt: "desc" }, take: 40 }),
    db.calendarEvent.findMany({ where: { OR: [{ departmentId: student.programme.departmentId }, { subjectId: { in: enrolments.map((row) => row.subjectId) } }] }, orderBy: { startsAt: "asc" }, take: 100 }),
    db.timetable.findMany({ where: { OR: [...enrolments.map((row) => ({ programmeId: student.programmeId, termId: row.termId, section: row.section })), { id: "__none__" }] }, orderBy: { issuedAt: "desc" }, take: 30 }),
  ]);
  const quizzes = allQuizzes.filter((quiz) => quiz.section && enrolments.some((row) => row.subjectId === quiz.subjectId && row.termId === quiz.termId && row.section === quiz.section));
  const events = allEvents.filter((event) => event.departmentId === student.programme.departmentId && !event.subjectId || enrolments.some((row) => row.subjectId === event.subjectId && row.termId === event.termId && row.section === event.section));
  const withFiles = await Promise.all(materials.map(async (item) => ({ ...item, fileUrl: item.storagePath ? await privateFileUrl(item.storagePath) : null })));
  const workWithFiles = await Promise.all(work.map(async (item) => ({ ...item, fileUrl: item.storagePath ? await privateFileUrl(item.storagePath) : null })));
  const latestTimetables = timetables.filter((item, index) => timetables.findIndex((other) => other.programmeId === item.programmeId && other.termId === item.termId && other.section === item.section) === index);
  const timetableFiles = await Promise.all(latestTimetables.map(async (item) => ({ ...item, url: await privateFileUrl(item.storagePath) })));
  const { ok, error } = await searchParams;
  return <main className="min-h-screen bg-[#0a1220] px-6 py-8 text-slate-100"><div className="mx-auto max-w-6xl">
    <Link href="/dashboard" className="text-sm text-cyan-300">← Dashboard</Link><h1 className="mt-6 text-3xl font-semibold">My academic workspace</h1>
    {ok && <p role="status" className="mt-5 rounded-lg border border-emerald-400/30 p-3 text-sm text-emerald-200">{ok}</p>}
    {error && <p role="alert" className="mt-5 rounded-lg border border-rose-400/30 p-3 text-sm text-rose-200">{error}</p>}
    {profileIncomplete && <div role="status" className="mt-6 rounded-xl border border-cyan-300/40 bg-cyan-300/10 p-5"><h2 className="font-semibold text-cyan-100">Complete your academic background</h2><p className="mt-2 text-sm text-slate-300">Add your high school, Class 12 or intermediate, branch{student.programme.level === "PG" ? ", and bachelor’s background" : ""}. Your assigned Teachers and HOD can use it to understand your prior study.</p><a href="#academic-background" className="mt-3 inline-block text-sm font-semibold text-cyan-300 underline">Go to background form</a></div>}
    <StudentProgress subjects={progress} reports={reports} />
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section id="academic-background" className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Academic background</h2><p className="mt-2 text-sm text-slate-400">Share your prior study and interests with assigned Teachers.</p>
        <form action={saveAcademicProfile} className="mt-4 space-y-3"><label className="block text-sm">High school<input name="highSchool" defaultValue={student.highSchool ?? ""} maxLength={160} required className={input} /></label><label className="block text-sm">Class 12 / intermediate<input name="intermediate" defaultValue={student.intermediate ?? ""} maxLength={160} required className={input} /></label>{student.programme.level === "PG" && <label className="block text-sm">Bachelors<input name="bachelors" defaultValue={student.bachelors ?? ""} maxLength={160} required className={input} /></label>}<label className="block text-sm">Branch or stream<input name="branch" defaultValue={student.branch ?? ""} maxLength={160} required className={input} /></label><label className="block text-sm">Interests, separated by commas<input name="interests" defaultValue={student.interests.join(", ")} className={input} /></label><button className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220]">Save background</button></form>
      </section>
      <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Resume and achievements</h2><p className="mt-2 text-xs text-slate-400">Files are private; your assigned Teachers and department HOD can view them. Up to 2 MB.</p>
        <form action={addStudentWork} className="mt-4 space-y-3"><label className="block text-sm">Type<select name="kind" className={input}><option value="RESUME">Resume</option><option value="CERTIFICATION">Certification</option><option value="SCHOLARSHIP">Scholarship</option><option value="PROJECT">Project</option><option value="OTHER">Other</option></select></label><label className="block text-sm">Title<input name="title" maxLength={120} required className={input} /></label><label className="block text-sm">Description<textarea name="description" maxLength={1000} rows={2} className={input} /></label><label className="block text-sm">HTTPS link, optional<input name="url" type="url" className={input} /></label><label className="block text-sm">File, required for a resume<input name="file" type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" className={input} /></label><button className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220]">Add item</button></form>
        <div className="mt-5 space-y-3">{workWithFiles.map((item) => <details key={item.id} className="rounded-lg border border-white/10 p-3"><summary className="cursor-pointer text-sm text-cyan-300">{item.title} ({item.kind}) · Edit</summary>{item.fileUrl && <a href={item.fileUrl} className="mt-2 inline-block text-sm text-cyan-300">Download</a>}{item.url && <a href={item.url} className="ml-2 text-sm text-cyan-300">Open link</a>}<form action={updateStudentWork} className="mt-3 space-y-2"><input type="hidden" name="workId" value={item.id} /><label className="block text-sm">Title<input name="title" defaultValue={item.title} required maxLength={120} className={input} /></label><label className="block text-sm">Description<textarea name="description" defaultValue={item.description ?? ""} maxLength={1000} rows={2} className={input} /></label><label className="block text-sm">HTTPS link<input name="url" type="url" defaultValue={item.url ?? ""} className={input} /></label><button className="rounded-lg border border-cyan-300 px-3 py-2 text-sm text-cyan-300">Save item</button></form></details>)}</div>
      </section>
    </div>
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Class notes and assignments</h2>{withFiles.length === 0 ? <p className="mt-4 text-sm text-slate-400">No materials published yet.</p> : <div className="mt-4 grid gap-4 md:grid-cols-2">{withFiles.map((item) => <article key={item.id} className="rounded-xl border border-white/10 p-4"><p className="text-xs text-cyan-300">{item.assignment.subject.name} · {item.kind}</p><h3 className="mt-1 font-semibold">{item.title}</h3><p className="mt-2 text-sm text-slate-400">{item.description}</p>{item.fileUrl && <a href={item.fileUrl} className="mt-2 inline-block text-sm text-cyan-300">Download file</a>}{item.dueAt && <p className="mt-2 text-xs text-slate-400">Due {formatAcademicTime(item.dueAt)}</p>}{item.kind === "ASSIGNMENT" && <form action={submitAssignment} className="mt-4 border-t border-white/10 pt-3"><input type="hidden" name="materialId" value={item.id} /><label className="block text-sm">Your submission<input name="file" type="file" required accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" className={input} /></label><button className="mt-3 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220]">{item.submissions.length ? "Replace submission" : "Submit"}</button></form>}</article>)}</div>}</section>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Quizzes</h2>{quizzes.length === 0 ? <p className="mt-4 text-sm text-slate-400">No quizzes published yet.</p> : <div className="mt-4 space-y-3">{quizzes.map((quiz) => <div key={quiz.id} className="rounded-lg border border-white/10 p-3"><p className="font-semibold">{quiz.title}</p><p className="mt-1 text-xs text-slate-400">{quiz.subject.name} · {quiz.timerSeconds / 60} minutes</p>{quiz.attempts.length ? <Link href={`/dashboard/student/quiz/${quiz.attempts[0].id}`} className="mt-2 inline-block text-sm text-cyan-300">View attempt</Link> : quiz.availableUntil && quiz.availableUntil <= new Date() ? <p className="mt-2 text-xs text-slate-400">Closed to new attempts</p> : <form action={startQuiz} className="mt-2"><input type="hidden" name="quizId" value={quiz.id} /><button className="text-sm text-cyan-300">Start quiz</button></form>}</div>)}</div>}</section>
      <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Shared calendar and timetable</h2>{timetableFiles.map((item) => <p key={item.id} className="mt-3 rounded-lg border border-white/10 p-3 text-sm">{item.title} · Section {item.section}{item.url && <a href={item.url} className="ml-3 text-cyan-300">Download PDF</a>}</p>)}{events.length === 0 ? <p className="mt-4 text-sm text-slate-400">No events yet.</p> : <div className="mt-4 space-y-2">{events.map((event) => <p key={event.id} className="rounded-lg border border-white/10 p-3 text-sm"><span className="font-semibold">{event.title}</span><span className="ml-2 text-xs text-slate-400">{event.kind} · {formatAcademicTime(event.startsAt)}</span></p>)}</div>}</section>
    </div>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Ask a Teacher or send feedback</h2><form action={sendAcademicFeedback} className="mt-4 space-y-3"><label className="block text-sm">Class<select name="assignmentId" required className={input}><option value="">Choose class</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.subject.name} · {group.teacher.name}</option>)}</select></label><label className="block text-sm">Title<input name="title" required maxLength={120} className={input} /></label><label className="block text-sm">Message<textarea name="body" required maxLength={2000} rows={3} className={input} /></label><button className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220]">Send message</button></form><div className="mt-5 space-y-3">{threads.map((thread) => <div key={thread.id} className="rounded-lg border border-white/10 p-3"><p className="font-semibold">{thread.title} <span className="text-xs font-normal text-slate-400">{thread.status}</span></p>{thread.messages.map((message) => <p key={message.id} className="mt-2 text-sm text-slate-300">{message.authorAuthId === student.authUserId ? "You" : "Teacher"}: {message.body}</p>)}</div>)}</div></section>
      <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Monthly reports and notices</h2>{reports.length === 0 ? <p className="mt-4 text-sm text-slate-400">No month-end report yet.</p> : <div className="mt-4 space-y-3">{reports.map((report) => <MonthlyReportCard key={report.id} month={report.month} summary={report.summary} />)}</div>}<h3 className="mt-6 font-semibold">Notices</h3><div className="mt-3 space-y-2">{notices.map((notice) => <p key={notice.id} className="rounded-lg border border-white/10 p-3 text-sm">{notice.message}</p>)}</div></section>
    </div>
  </div></main>;
}
