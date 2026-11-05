import Link from "next/link";
import { redirect } from "next/navigation";
import { roleForAuthUser } from "@/lib/access";
import { getDb } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { AssignmentForm } from "./assignment-form";

export const dynamic = "force-dynamic";

export default async function HodAssignmentsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const role = await roleForAuthUser(data.claims.sub);
  if (role?.kind !== "HOD") redirect("/dashboard");

  const db = getDb();
  const hod = await db.hOD.findUnique({ where: { id: role.id }, include: { department: true } });
  if (!hod) redirect("/dashboard");
  const departmentId = hod.departmentId;
  const [teachers, subjects, terms, assignments] = await Promise.all([
    db.teacher.findMany({ where: { departmentId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.subject.findMany({ where: { programme: { departmentId } }, select: { id: true, name: true, programmeId: true, programme: { select: { code: true } } }, orderBy: { name: "asc" } }),
    db.term.findMany({ where: { programme: { departmentId } }, select: { id: true, label: true, programmeId: true }, orderBy: { startsOn: "desc" } }),
    db.teachingAssignment.findMany({ where: { teacher: { departmentId }, subject: { programme: { departmentId } } }, include: { teacher: true, subject: { include: { programme: true } }, term: true }, orderBy: { subject: { name: "asc" } } }),
  ]);

  return <main className="min-h-screen bg-[#0a1220] px-6 py-8 text-slate-100"><div className="mx-auto max-w-6xl">
    <Link href="/dashboard" className="text-sm text-cyan-300 hover:underline">← Dashboard</Link>
    <h1 className="mt-6 text-3xl font-semibold">Teaching assignments</h1>
    <p className="mt-2 text-sm text-slate-400">{hod.department.name}. Assign a Teacher to a subject, term and section in your department.</p>
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Assign Teacher</h2>
      <AssignmentForm teachers={teachers} subjects={subjects} terms={terms} />
    </section>
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Current assignments</h2>
      {assignments.length === 0 ? <p className="mt-4 text-sm text-slate-400">No teaching groups assigned yet.</p> :
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-slate-400"><tr><th className="pb-3">Teacher</th><th className="pb-3">Subject</th><th className="pb-3">Term</th><th className="pb-3">Section</th></tr></thead><tbody>{assignments.map((assignment) => <tr key={assignment.id} className="border-t border-white/10"><td className="py-3">{assignment.teacher.name}</td><td className="py-3">{assignment.subject.programme.code} · {assignment.subject.name}</td><td className="py-3">{assignment.term.label}</td><td className="py-3">{assignment.section}</td></tr>)}</tbody></table></div>}
    </section>
  </div></main>;
}
