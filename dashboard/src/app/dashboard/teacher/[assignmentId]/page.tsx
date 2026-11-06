import Link from "next/link";
import { academicTimeInput, formatAcademicTime } from "@/lib/academic-time";
import { getDb } from "@/lib/db";
import { privateFileUrl } from "@/lib/private-files";
import { requireTeachingGroup } from "@/lib/teacher-access";
import { closeQuiz, createQuiz, createSubjectEvent, setCombinedRule, updateSubjectEvent, uploadMaterial } from "../actions";

export const dynamic = "force-dynamic";
const input = "mt-1 w-full rounded-lg border border-white/20 bg-[#0a1220] px-3 py-2 text-sm";

export default async function TeachingGroupPage({ params, searchParams }: {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { assignmentId } = await params;
  const { teacher, group } = await requireTeachingGroup(assignmentId);
  const db = getDb();
  const [enrolments, materials, quizzes, events] = await Promise.all([
    db.enrolment.findMany({ where: { subjectId: group.subjectId, termId: group.termId, section: group.section }, include: { student: true }, orderBy: { student: { name: "asc" } } }),
    db.teachingMaterial.findMany({ where: { assignmentId }, include: { submissions: { include: { student: true } } }, orderBy: { createdAt: "desc" } }),
    db.quiz.findMany({ where: { teacherId: group.teacherId, subjectId: group.subjectId, termId: group.termId, section: group.section }, include: { attempts: { include: { student: true } } }, orderBy: { publishedAt: "desc" } }),
    db.calendarEvent.findMany({ where: { OR: [
      { subjectId: group.subjectId, termId: group.termId, section: group.section },
      { departmentId: group.subject.programme.departmentId, subjectId: null },
    ] }, orderBy: { startsAt: "asc" } }),
  ]);
  const files = await Promise.all(materials.map(async (material) => ({
    ...material, url: material.storagePath ? await privateFileUrl(material.storagePath) : null,
    submissions: await Promise.all(material.submissions.map(async (submission) => ({ ...submission, url: await privateFileUrl(submission.storagePath) }))),
  })));
  const { ok, error } = await searchParams;
  return <main className="min-h-screen bg-[#0a1220] px-6 py-8 text-slate-100"><div className="mx-auto max-w-6xl">
    <Link href="/dashboard/teacher" className="text-sm text-cyan-300">← Teacher workspace</Link>
    <h1 className="mt-6 text-3xl font-semibold">{group.subject.name}</h1><p className="mt-2 text-sm text-slate-400">{group.term.label} · Section {group.section} · {group.subject.programme.name}</p>
    {ok && <p role="status" className="mt-5 rounded-lg border border-emerald-400/30 p-3 text-sm text-emerald-200">{ok}</p>}
    {error && <p role="alert" className="mt-5 rounded-lg border border-rose-400/30 p-3 text-sm text-rose-200">{error}</p>}
    <div className="mt-7 flex flex-wrap gap-3"><Link href="/dashboard/import" className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220]">Upload marks or attendance</Link></div>
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-xl font-semibold">Class roster</h2>
      <p className="mt-2 text-sm text-slate-400">Open a Student to review their background, resume, released results across subjects and monthly reports.</p>
      {enrolments.length === 0 ? <p className="mt-4 text-sm text-slate-400">No Students enrolled in this section yet.</p> : <div className="mt-5 grid gap-2 sm:grid-cols-2">{enrolments.map(({ student }) => <Link key={student.id} href={`/dashboard/teacher/${assignmentId}/student/${student.id}`} className="rounded-lg border border-white/10 p-3 text-sm hover:border-cyan-300/50">{student.name} <span className="ml-2 text-slate-400">{student.facultyNo}</span></Link>)}</div>}
    </section>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Sessional calculation</h2><p className="mt-2 text-sm text-slate-400">Students see only your selected combined rule.</p>
        <form action={setCombinedRule} className="mt-4 flex gap-3"><input type="hidden" name="assignmentId" value={assignmentId} /><select name="rule" defaultValue={group.subject.combinedRule} className={input}><option value="SUM">Sum</option><option value="AVERAGE">Average</option></select><button className="self-end rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220]">Save</button></form>
      </section>
      <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Publish notes or assignment</h2><p className="mt-2 text-xs text-slate-400">PDF, DOCX, TXT or image; up to 2 MB. Files are private to the class.</p>
        <form action={uploadMaterial} className="mt-4 space-y-3"><input type="hidden" name="assignmentId" value={assignmentId} /><label className="block text-sm">Type<select name="kind" className={input}><option value="NOTE">Notes</option><option value="ASSIGNMENT">Assignment</option></select></label><label className="block text-sm">Title<input name="title" required maxLength={120} className={input} /></label><label className="block text-sm">Description<textarea name="description" maxLength={1000} rows={2} className={input} /></label><label className="block text-sm">Assignment deadline, if applicable<input name="dueAt" type="datetime-local" className={input} /></label><label className="block text-sm">File<input name="file" type="file" required accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" className={input} /></label><button className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220]">Publish</button></form>
      </section>
    </div>
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Coursework and submissions</h2>
      {files.length === 0 ? <p className="mt-4 text-sm text-slate-400">Nothing published yet.</p> : <div className="mt-4 space-y-4">{files.map((material) => <div key={material.id} className="rounded-xl border border-white/10 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{material.title}</p><span className="text-xs text-cyan-300">{material.kind}</span></div><p className="mt-1 text-sm text-slate-400">{material.description}</p>{material.url && <a href={material.url} className="mt-2 inline-block text-sm text-cyan-300">Download file</a>}{material.dueAt && <p className="mt-2 text-xs text-slate-400">Due {formatAcademicTime(material.dueAt)}</p>}{material.kind === "ASSIGNMENT" && <div className="mt-3 border-t border-white/10 pt-3"><p className="text-xs text-slate-400">{material.submissions.length} submission(s)</p>{material.submissions.map((submission) => <p key={submission.id} className="mt-2 text-sm">{submission.student.name} · {formatAcademicTime(submission.submittedAt)} {submission.url && <a href={submission.url} className="ml-2 text-cyan-300">Download</a>}</p>)}</div>}</div>)}</div>}
    </section>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Create timed MCQ quiz</h2><p className="mt-2 text-xs leading-5 text-slate-400">One question per line: question | A | B | C | D | correct letter. Up to 30 questions.</p>
        <form action={createQuiz} className="mt-4 space-y-3"><input type="hidden" name="assignmentId" value={assignmentId} /><label className="block text-sm">Title<input name="title" required maxLength={120} className={input} /></label><label className="block text-sm">Class attendance date<input name="attendanceOn" type="date" defaultValue={academicTimeInput(new Date()).slice(0, 10)} required className={input} /></label><label className="block text-sm">Session number<input name="attendanceSessionNo" type="number" min={1} max={20} defaultValue={1} required className={input} /></label><p className="text-xs text-slate-400">A plain date column is session 1; use a header such as 2026-11-06#2 for session 2.</p><label className="block text-sm">Timer per Student (minutes)<input name="minutes" type="number" min={1} max={60} defaultValue={10} required className={input} /></label><label className="block text-sm">Open to new attempts for (minutes)<input name="availabilityMinutes" type="number" min={1} max={180} defaultValue={60} required className={input} /></label><label className="block text-sm">Questions<textarea name="questions" required rows={6} placeholder="What is 2 + 2? | 2 | 3 | 4 | 5 | C" className={input} /></label><button className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220]">Publish quiz</button></form>
        <div className="mt-5 space-y-2">{quizzes.map((quiz) => <div key={quiz.id} className="rounded-lg border border-white/10 p-3 text-sm"><p>{quiz.title} · {quiz.timerSeconds / 60} min · {quiz.attempts.length} attempt(s)</p><p className="mt-1 text-xs text-slate-400">{quiz.availableUntil ? `New attempts close ${formatAcademicTime(quiz.availableUntil)}` : "No close time set"}</p><Link href={`/dashboard/teacher/${assignmentId}/quiz/${quiz.id}`} className="mt-2 inline-block text-sm text-cyan-300">Review attendance and activity</Link>{quiz.availableUntil && quiz.availableUntil > new Date() && <form action={closeQuiz} className="mt-2"><input type="hidden" name="assignmentId" value={assignmentId} /><input type="hidden" name="quizId" value={quiz.id} /><button className="text-xs text-amber-300">Close now</button></form>}{quiz.attempts.map((attempt) => <p key={attempt.id} className="mt-1 text-xs text-slate-400">{attempt.student.name}: {attempt.submittedAt ? `${attempt.score ?? 0} points${attempt.timedOut ? " (timed out)" : ""}` : "In progress"}</p>)}</div>)}</div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Shared calendar</h2><p className="mt-2 text-xs text-slate-400">Publish a sessional, quiz date or assignment deadline for this section.</p>
        <form action={createSubjectEvent} className="mt-4 space-y-3"><input type="hidden" name="assignmentId" value={assignmentId} /><label className="block text-sm">Type<select name="kind" className={input}><option value="SESSIONAL">Sessional</option><option value="QUIZ">Quiz</option><option value="ASSIGNMENT">Assignment deadline</option></select></label><label className="block text-sm">Title<input name="title" maxLength={120} required className={input} /></label><label className="block text-sm">Date and time<input type="datetime-local" name="startsAt" required className={input} /></label><button className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220]">Publish item</button></form>
        <div className="mt-5 space-y-3">{events.map((event) => event.createdByAuthId === teacher.authUserId && event.subjectId === group.subjectId && event.termId === group.termId && event.section === group.section ? <form key={event.id} action={updateSubjectEvent} className="rounded-lg border border-white/10 p-3"><input type="hidden" name="assignmentId" value={assignmentId} /><input type="hidden" name="eventId" value={event.id} /><p className="text-xs text-slate-400">{event.kind}</p><input name="title" defaultValue={event.title} required maxLength={120} className={input} /><input name="startsAt" type="datetime-local" defaultValue={academicTimeInput(event.startsAt)} required className={input} /><button className="mt-2 text-sm text-cyan-300">Save changes</button></form> : <p key={event.id} className="rounded-lg border border-white/10 p-3 text-sm">{event.title} · {event.kind} · {formatAcademicTime(event.startsAt)}</p>)}</div>
      </section>
    </div>
  </div></main>;
}
