import Link from "next/link";
import { notFound } from "next/navigation";
import { MonthlyReportCard } from "@/app/dashboard/monthly-report-card";
import { attendanceSummary, combinedSessional } from "@/lib/academic";
import { getDb } from "@/lib/db";
import { requireHod } from "@/lib/hod-access";
import { privateFileUrl } from "@/lib/private-files";

export const dynamic = "force-dynamic";
const panel = "rounded-2xl border border-white/10 bg-[#101e30] p-6";

export default async function HodStudentProfile({ params }: { params: Promise<{ studentId: string }> }) {
  const hod = await requireHod();
  const { studentId } = await params;
  const db = getDb();
  const student = await db.student.findFirst({ where: { id: studentId, programme: { departmentId: hod.departmentId } }, include: { programme: true } });
  if (!student) notFound();
  const [marks, attendance, work, reports, attempts] = await Promise.all([
    db.mark.findMany({ where: { studentId, status: "RELEASED" }, include: { subject: true, term: true }, orderBy: { updatedAt: "desc" } }),
    db.attendanceRecord.findMany({ where: { studentId, recordStatus: "RELEASED" }, include: { subject: true }, orderBy: { sessionOn: "desc" } }),
    db.studentWork.findMany({ where: { studentId }, orderBy: { updatedAt: "desc" } }),
    db.monthlyReport.findMany({ where: { studentId }, orderBy: { month: "desc" }, take: 12 }),
    db.quizAttempt.findMany({ where: { studentId, quiz: { subject: { programme: { departmentId: hod.departmentId } } } }, include: { quiz: { include: { subject: true } } }, orderBy: { startedAt: "desc" }, take: 30 }),
  ]);
  const files = await Promise.all(work.map(async (item) => ({ ...item, fileUrl: item.storagePath ? await privateFileUrl(item.storagePath) : null })));
  const bySubject = new Map<string, typeof attendance>();
  for (const row of attendance) bySubject.set(row.subjectId, [...(bySubject.get(row.subjectId) ?? []), row]);
  return <main className="min-h-screen bg-[#0a1220] px-6 py-8 text-slate-100"><div className="mx-auto max-w-5xl space-y-6">
    <div><Link href="/dashboard/hod" className="text-sm text-cyan-300">← Department</Link><h1 className="mt-6 text-3xl font-semibold">{student.name}</h1><p className="mt-2 text-sm text-slate-400">{student.programme.name} · Faculty no. {student.facultyNo} · Enrolment {student.enrolmentNo}</p><p className="mt-2 text-xs text-slate-500">Department view is read-only. Changes to marks or attendance require your own teaching assignment.</p></div>
    <div className="grid gap-6 lg:grid-cols-2"><section className={panel}><h2 className="text-lg font-semibold">Academic background</h2><dl className="mt-4 space-y-2 text-sm">{[["High school", student.highSchool], ["Intermediate", student.intermediate], ["Bachelors", student.programme.level === "PG" ? student.bachelors : null], ["Branch", student.branch], ["Interests", student.interests.join(", ")]].filter(([label]) => label !== "Bachelors" || student.programme.level === "PG").map(([label, value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd>{value || "Not provided"}</dd></div>)}</dl></section>
      <section className={panel}><h2 className="text-lg font-semibold">Resume and achievements</h2><div className="mt-4 space-y-3">{files.length === 0 ? <p className="text-sm text-slate-400">No items yet.</p> : files.map((item) => <div key={item.id} className="rounded-lg border border-white/10 p-3"><p className="font-semibold">{item.title} <span className="text-xs text-slate-400">{item.kind}</span></p><p className="mt-1 text-sm text-slate-400">{item.description}</p>{item.fileUrl && <a href={item.fileUrl} className="text-sm text-cyan-300">Download file</a>}</div>)}</div></section></div>
    <section className={panel}><h2 className="text-lg font-semibold">Released marks</h2><div className="mt-4 space-y-2">{marks.length === 0 ? <p className="text-sm text-slate-400">No released marks.</p> : marks.map((mark) => <p key={mark.id} className="rounded-lg border border-white/10 p-3 text-sm">{mark.subject.name} · {mark.term.label} · S1 {mark.sessional1 ?? "—"} · S2 {mark.sessional2 ?? "—"} · Combined {combinedSessional(mark.sessional1, mark.sessional2, mark.subject.combinedRule) ?? "—"}</p>)}</div></section>
    <section className={panel}><h2 className="text-lg font-semibold">Attendance</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{bySubject.size === 0 ? <p className="text-sm text-slate-400">No released attendance.</p> : Array.from(bySubject, ([id, rows]) => { const summary = attendanceSummary(rows.map((row) => row.status), false); return <div key={id} className="rounded-lg border border-white/10 p-3 text-sm">{rows[0].subject.name} · {summary.percentage === null ? "No data" : `${summary.percentage.toFixed(1)}%`} ({summary.attended}/{summary.counted})</div>; })}</div></section>
    <section className={panel}><h2 className="text-lg font-semibold">Quiz attempts</h2><div className="mt-4 space-y-2">{attempts.length === 0 ? <p className="text-sm text-slate-400">No attempts yet.</p> : attempts.map((item) => <p key={item.id} className="rounded-lg border border-white/10 p-3 text-sm">{item.quiz.subject.name} · {item.quiz.title} · {item.submittedAt ? `${item.score ?? 0} points` : "In progress"}</p>)}</div></section>
    <section className={panel}><h2 className="text-lg font-semibold">Monthly reports</h2><div className="mt-4 space-y-3">{reports.length === 0 ? <p className="text-sm text-slate-400">No reports yet.</p> : reports.map((report) => <MonthlyReportCard key={report.id} month={report.month} summary={report.summary} />)}</div></section>
  </div></main>;
}
