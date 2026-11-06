import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireTeacher } from "@/lib/teacher-access";
import { releaseBatch } from "../actions";

export const dynamic = "force-dynamic";
const pageSize = 100;

export default async function ImportReview({ params, searchParams }: { params: Promise<{ batchId: string }>; searchParams: Promise<{ page?: string }> }) {
  if (!process.env.DATABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) redirect("/dashboard");
  const teacher = await requireTeacher();
  const { batchId } = await params;
  const batch = await getDb().importBatch.findFirst({ where: { id: batchId, assignment: { teacherId: teacher.teacherId } }, include: { assignment: { include: { subject: true, term: true } } } });
  if (!batch) notFound();
  const inputPage = Number((await searchParams).page ?? "1");
  const page = Number.isSafeInteger(inputPage) && inputPage > 0 ? inputPage : 1;
  const db = getDb();
  const isMarks = batch.kind === "MARKS";
  const [total, marks, attendance] = await Promise.all([
    isMarks ? db.mark.count({ where: { batchId } }) : db.attendanceRecord.count({ where: { batchId } }),
    isMarks ? db.mark.findMany({ where: { batchId }, include: { student: true }, orderBy: { student: { name: "asc" } }, skip: (page - 1) * pageSize, take: pageSize }) : Promise.resolve([]),
    !isMarks ? db.attendanceRecord.findMany({ where: { batchId }, include: { student: true }, orderBy: [{ sessionOn: "asc" }, { student: { name: "asc" } }], skip: (page - 1) * pageSize, take: pageSize }) : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <main className="min-h-screen bg-[#0a1220] px-6 py-8 text-slate-100"><div className="mx-auto max-w-6xl"><Link href="/dashboard/import" className="text-sm text-cyan-300 hover:underline">← Academic imports</Link><div className="mt-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">Review {isMarks ? "marks" : "attendance"} draft</h1><p className="mt-2 text-sm text-slate-400">{batch.assignment.subject.name} · {batch.assignment.term.label} · Section {batch.assignment.section} · version {batch.version}</p><p className="mt-1 text-xs text-slate-500">Source: {batch.sourceName} · {total} record(s)</p></div><span className="rounded-full border border-white/20 px-3 py-1 text-xs">{batch.status}</span></div>
    <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-[#101e30]"><table className="min-w-full text-left text-sm"><thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Faculty no.</th>{isMarks ? <><th className="px-4 py-3">Sessional 1</th><th className="px-4 py-3">Sessional 2</th><th className="px-4 py-3">Imported total</th></> : <><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th></>}</tr></thead><tbody className="divide-y divide-white/10">{isMarks ? marks.map((row) => <tr key={row.id}><td className="px-4 py-3">{row.student.name}</td><td className="px-4 py-3 text-slate-400">{row.student.facultyNo}</td><td className="px-4 py-3">{row.sessional1 ?? "No data"}</td><td className="px-4 py-3">{row.sessional2 ?? "No data"}</td><td className="px-4 py-3">{row.importedTotal ?? "No data"}</td></tr>) : attendance.map((row) => <tr key={row.id}><td className="px-4 py-3">{row.student.name}</td><td className="px-4 py-3 text-slate-400">{row.student.facultyNo}</td><td className="px-4 py-3">{row.sessionOn.toISOString().slice(0, 10)}</td><td className="px-4 py-3">{row.status.toLowerCase()}</td></tr>)}</tbody></table>{total === 0 && <p className="p-5 text-sm text-slate-400">This draft has no records.</p>}</div>
    <div className="mt-5 flex items-center justify-between text-sm"><span className="text-slate-400">Page {Math.min(page, pages)} of {pages}</span><div className="flex gap-4">{page > 1 && <Link href={`/dashboard/import/${batchId}?page=${page - 1}`} className="text-cyan-300 hover:underline">Previous</Link>}{page < pages && <Link href={`/dashboard/import/${batchId}?page=${page + 1}`} className="text-cyan-300 hover:underline">Next</Link>}</div></div>
    {batch.status === "DRAFT" && <div className="mt-8 rounded-xl border border-amber-300/20 bg-amber-300/5 p-5"><p className="text-sm leading-6 text-slate-300">Check the records and source before release. Students see only released versions; this step does not send data to the university portal.</p><form action={releaseBatch} className="mt-4"><input type="hidden" name="batchId" value={batch.id} /><button className="rounded-lg bg-cyan-400 px-5 py-3 text-sm font-semibold text-[#0a1220] hover:bg-cyan-300">Release this draft</button></form></div>}
  </div></main>;
}
