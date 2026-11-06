import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireHod } from "@/lib/hod-access";

export const dynamic = "force-dynamic";

export default async function HodTeacherProfile({ params }: { params: Promise<{ teacherId: string }> }) {
  const hod = await requireHod();
  const { teacherId } = await params;
  const teacher = await getDb().teacher.findFirst({
    where: { id: teacherId, departmentId: hod.departmentId },
    include: { assignments: { include: { subject: { include: { programme: true } }, term: true, _count: { select: { materials: true } } }, orderBy: { subject: { name: "asc" } } }, _count: { select: { quizzes: true, questions: true } } },
  });
  if (!teacher) notFound();
  return <main className="min-h-screen bg-[#0a1220] px-6 py-8 text-slate-100"><div className="mx-auto max-w-4xl">
    <Link href="/dashboard/hod" className="text-sm text-cyan-300">← Department</Link><h1 className="mt-6 text-3xl font-semibold">{teacher.name}</h1><p className="mt-2 text-sm text-slate-400">Teacher profile · {hod.department.name}</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-3">{[["Teaching groups", teacher.assignments.length], ["Quizzes", teacher._count.quizzes], ["Feedback threads", teacher._count.questions]].map(([label, count]) => <div key={label} className="rounded-xl border border-white/10 bg-[#101e30] p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold text-cyan-300">{count}</p></div>)}</div>
    <section className="mt-6 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-xl font-semibold">Assigned classes</h2>{teacher.assignments.length === 0 ? <p className="mt-4 text-sm text-slate-400">No classes assigned.</p> : <div className="mt-4 space-y-3">{teacher.assignments.map((group) => <div key={group.id} className="rounded-lg border border-white/10 p-4"><p className="font-semibold">{group.subject.name}</p><p className="mt-1 text-sm text-slate-400">{group.subject.programme.code} · {group.term.label} · Section {group.section} · {group._count.materials} materials</p></div>)}</div>}</section>
  </div></main>;
}
