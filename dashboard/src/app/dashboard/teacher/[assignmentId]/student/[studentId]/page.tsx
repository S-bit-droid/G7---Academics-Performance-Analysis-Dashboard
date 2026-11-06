import { MonthlyReportCard } from "@/app/dashboard/monthly-report-card";
import Link from "next/link";
import { attendanceSummary, combinedSessional } from "@/lib/academic";
import { getDb } from "@/lib/db";
import { privateFileUrl } from "@/lib/private-files";
import { requireStudentInGroup } from "@/lib/teacher-access";

export const dynamic = "force-dynamic";

export default async function TeacherStudentPage({ params }: { params: Promise<{ assignmentId: string; studentId: string }> }) {
  const { assignmentId, studentId } = await params;
  const { group, student } = await requireStudentInGroup(assignmentId, studentId);
  const db = getDb();
  const [marks, attendance, work, reports] = await Promise.all([
    db.mark.findMany({ where: { studentId, status: "RELEASED" }, include: { subject: true, term: true }, orderBy: { updatedAt: "desc" } }),
    db.attendanceRecord.findMany({ where: { studentId, recordStatus: "RELEASED" }, include: { subject: true, term: true }, orderBy: { sessionOn: "desc" } }),
    db.studentWork.findMany({ where: { studentId }, orderBy: { updatedAt: "desc" } }),
    db.monthlyReport.findMany({ where: { studentId }, orderBy: { month: "desc" }, take: 12 }),
  ]);
  const workWithFiles = await Promise.all(work.map(async (item) => ({ ...item, fileUrl: item.storagePath ? await privateFileUrl(item.storagePath) : null })));
  const bySubject = new Map<string, typeof attendance>();
  for (const row of attendance) bySubject.set(row.subjectId, [...(bySubject.get(row.subjectId) ?? []), row]);
  return <main className="min-h-screen bg-[#0a1220] px-6 py-8 text-slate-100"><div className="mx-auto max-w-6xl">
    <Link href={`/dashboard/teacher/${assignmentId}`} className="text-sm text-cyan-300">← {group.subject.name}</Link>
    <h1 className="mt-6 text-3xl font-semibold">{student.name}</h1><p className="mt-2 text-sm text-slate-400">Faculty no. {student.facultyNo} · Enrolment {student.enrolmentNo} · {student.programme.name}</p>
    <p className="mt-3 text-xs text-slate-500">Other subjects are shown for comparison only. You can change records only for {group.subject.name} through your own import workflow.</p>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Academic background</h2><dl className="mt-4 space-y-2 text-sm"><div><dt className="text-slate-400">High school</dt><dd>{student.highSchool || "Not provided"}</dd></div><div><dt className="text-slate-400">Intermediate</dt><dd>{student.intermediate || "Not provided"}</dd></div>{student.programme.level === "PG" && <div><dt className="text-slate-400">Bachelors</dt><dd>{student.bachelors || "Not provided"}</dd></div>}<div><dt className="text-slate-400">Branch or stream</dt><dd>{student.branch || "Not provided"}</dd></div><div><dt className="text-slate-400">Interests</dt><dd>{student.interests.join(", ") || "Not provided"}</dd></div></dl></section>
      <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Resume and achievements</h2>{workWithFiles.length === 0 ? <p className="mt-4 text-sm text-slate-400">No self-reported items yet.</p> : <div className="mt-4 space-y-3">{workWithFiles.map((item) => <div key={item.id} className="rounded-lg border border-white/10 p-3"><p className="font-semibold">{item.title} <span className="text-xs font-normal text-slate-400">{item.kind}</span></p><p className="mt-1 text-sm text-slate-400">{item.description}</p>{item.fileUrl && <a href={item.fileUrl} className="text-sm text-cyan-300">Download file</a>}{item.url && <a href={item.url} className="ml-3 text-sm text-cyan-300">Open link</a>}</div>)}</div>}</section>
    </div>
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Released results across subjects</h2>
      {marks.length === 0 ? <p className="mt-4 text-sm text-slate-400">No released marks yet.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-slate-400"><tr><th className="pb-3">Subject</th><th className="pb-3">Term</th><th className="pb-3">Sessional 1</th><th className="pb-3">Sessional 2</th><th className="pb-3">Combined</th></tr></thead><tbody>{marks.map((mark) => <tr key={mark.id} className="border-t border-white/10"><td className="py-3">{mark.subject.name}{mark.subjectId === group.subjectId && <span className="ml-2 text-xs text-cyan-300">Your subject</span>}</td><td>{mark.term.label}</td><td>{mark.sessional1 ?? "No data"}</td><td>{mark.sessional2 ?? "No data"}</td><td>{combinedSessional(mark.sessional1, mark.sessional2, mark.subject.combinedRule) ?? "No data"} <span className="text-xs text-slate-400">({mark.subject.combinedRule.toLowerCase()})</span></td></tr>)}</tbody></table></div>}
    </section>
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Attendance across subjects</h2>{bySubject.size === 0 ? <p className="mt-4 text-sm text-slate-400">No released attendance yet.</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{Array.from(bySubject, ([id, rows]) => { const summary = attendanceSummary(rows.map((row) => row.status), false); return <div key={id} className="rounded-lg border border-white/10 p-4"><p className="font-semibold">{rows[0].subject.name}</p><p className="mt-2 text-sm text-slate-300">{summary.percentage === null ? "No data" : `${summary.percentage.toFixed(1)}%`} · {summary.attended}/{summary.counted} counted sessions</p></div>; })}</div>}</section>
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Monthly reports</h2>{reports.length === 0 ? <p className="mt-4 text-sm text-slate-400">No month-end report has been generated yet.</p> : <div className="mt-4 space-y-3">{reports.map((report) => <MonthlyReportCard key={report.id} month={report.month} summary={report.summary} />)}</div>}</section>
  </div></main>;
}
