import Link from "next/link";
import { redirect } from "next/navigation";
import { roleForAuthUser } from "@/lib/access";
import { getDb } from "@/lib/db";
import { listAuthUsers } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AccountForms } from "./account-forms";
import { ScopeForms } from "./scope-forms";

export const dynamic = "force-dynamic";

function activityWindowStart() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const role = await roleForAuthUser(data.claims.sub);
  if (role?.kind !== "ADMIN") redirect("/dashboard");

  const db = getDb();
  const since = activityWindowStart();
  const [departments, programmes, students, teachers, hods, admins, subjects, terms, imports, attempts] = await Promise.all([
    db.department.findMany({ select: { code: true, name: true }, orderBy: { code: "asc" } }),
    db.programme.findMany({ select: { code: true, name: true }, orderBy: { code: "asc" } }),
    db.student.findMany({ select: { id: true, authUserId: true, name: true, programmeId: true, programme: { select: { code: true } } }, orderBy: { name: "asc" }, take: 50 }),
    db.teacher.findMany({ select: { id: true, authUserId: true, name: true, departmentId: true, department: { select: { code: true } } }, orderBy: { name: "asc" }, take: 50 }),
    db.hOD.findMany({ select: { authUserId: true, name: true, department: { select: { code: true } } }, orderBy: { name: "asc" }, take: 50 }),
    db.admin.findMany({ select: { authUserId: true, name: true }, orderBy: { name: "asc" }, take: 50 }),
    db.subject.findMany({ select: { id: true, name: true, programmeId: true, programme: { select: { departmentId: true } } }, orderBy: { name: "asc" } }),
    db.term.findMany({ select: { id: true, label: true, programmeId: true }, orderBy: { startsOn: "desc" } }),
    db.importBatch.count({ where: { createdAt: { gte: since } } }),
    db.quizAttempt.count({ where: { startedAt: { gte: since } } }),
  ]);

  const inviteReady = process.env.AUTH_INVITE_TEMPLATE_READY === "true";
  let authUsers: Awaited<ReturnType<typeof listAuthUsers>> = [];
  let authError = "";
  try { authUsers = await listAuthUsers(); }
  catch (error) { authError = error instanceof Error ? error.message : "Account service is unavailable."; }
  const byId = new Map(authUsers.map((user) => [user.id, user]));
  const accounts = [
    ...students.map((item) => ({ ...item, kind: "Student", scope: item.programme.code })),
    ...teachers.map((item) => ({ ...item, kind: "Teacher", scope: item.department.code })),
    ...hods.map((item) => ({ ...item, kind: "HOD", scope: item.department.code })),
    ...admins.map((item) => ({ ...item, kind: "Admin", scope: "System" })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const recentSignIns = authUsers.filter((user) => user.lastSignInAt && new Date(user.lastSignInAt) >= since).length;

  return <main className="min-h-screen bg-[#0a1220] px-6 py-8 text-slate-100"><div className="mx-auto max-w-7xl"><Link href="/dashboard" className="text-sm text-cyan-300 hover:underline">← Dashboard</Link><h1 className="mt-6 text-3xl font-semibold">Admin accounts</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Create role accounts, send invitations and review basic activity. Academic marks and attendance remain with the assigned teaching staff.</p>
    {authError && <p role="alert" className="mt-6 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-200">{authError} Account creation is unavailable until the server key is configured.</p>}
    {!authError && !inviteReady && <p role="alert" className="mt-6 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-200">Invite emails need the Supabase invite template and AUTH_INVITE_TEMPLATE_READY=true before accounts can be created.</p>}
    <div className="mt-8 grid gap-4 sm:grid-cols-3">{[["Recent sign-ins", recentSignIns], ["Academic imports", imports], ["Quiz attempts", attempts]].map(([label, count]) => <div key={label} className="rounded-xl border border-white/10 bg-[#101e30] p-5"><p className="text-sm text-slate-400">{label} · last 7 days</p><p className="mt-2 text-3xl font-semibold text-cyan-300">{authError && label === "Recent sign-ins" ? "Unavailable" : count}</p></div>)}</div>
    {!authError && <div className="mt-8"><AccountForms departments={departments} programmes={programmes} /></div>}
    <ScopeForms students={students.map((item) => ({ id: item.id, name: item.name, programmeId: item.programmeId }))} subjects={subjects.map((item) => ({ id: item.id, name: item.name, programmeId: item.programmeId }))} terms={terms} />
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Accounts and access</h2><p className="mt-2 text-sm text-slate-400">Showing up to 50 records per role. Role and academic scope are set when each account is created.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-slate-400"><tr><th className="pb-3">Name</th><th className="pb-3">Email</th><th className="pb-3">Role</th><th className="pb-3">Scope</th><th className="pb-3">Last sign-in</th></tr></thead><tbody>{accounts.map((account) => { const auth = byId.get(account.authUserId); return <tr key={account.authUserId} className="border-t border-white/10"><td className="py-3">{account.name}</td><td className="py-3 text-slate-300">{auth?.email ?? "Unavailable"}</td><td className="py-3">{account.kind}</td><td className="py-3">{account.scope}</td><td className="py-3 text-slate-400">{auth?.lastSignInAt ? new Date(auth.lastSignInAt).toLocaleDateString("en-IN") : "Not yet"}</td></tr>; })}</tbody></table>{accounts.length === 0 && <p className="py-5 text-sm text-slate-400">No role accounts yet.</p>}</div></section>
  </div></main>;
}
