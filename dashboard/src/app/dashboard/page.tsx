import Link from "next/link";
import { redirect } from "next/navigation";
import { attendanceSummary, combinedSessional, marksWarning } from "@/lib/academic";
import { roleForAuthUser, type DashboardRole } from "@/lib/access";
import { getDb } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export const dynamic = "force-dynamic";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">{title}</h2><div className="mt-5">{children}</div></section>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-white/15 p-5 text-sm leading-6 text-slate-400">{children}</p>;
}

async function StudentView({ role }: { role: DashboardRole & { kind: "STUDENT" } }) {
  const student = await getDb().student.findUnique({
    where: { id: role.id },
    include: {
      programme: true,
      marks: { where: { status: "RELEASED" }, include: { subject: true }, orderBy: { updatedAt: "desc" } },
      attendance: { where: { recordStatus: "RELEASED" }, include: { subject: true, source: true }, orderBy: { sessionOn: "desc" } },
      notices: { orderBy: { createdAt: "desc" }, take: 6 },
    },
  });
  if (!student) return <Empty>Student record unavailable.</Empty>;

  const attendanceBySubject = new Map<string, typeof student.attendance>();
  for (const row of student.attendance) {
    attendanceBySubject.set(row.subjectId, [...(attendanceBySubject.get(row.subjectId) ?? []), row]);
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-widest text-slate-400">Programme</p><p className="mt-3 text-xl font-semibold">{student.programme.name}</p></div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-widest text-slate-400">Released subjects</p><p className="mt-3 text-3xl font-semibold text-cyan-300">{student.marks.length}</p></div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5"><p className="text-xs uppercase tracking-widest text-slate-400">Faculty number</p><p className="mt-3 text-xl font-semibold">{student.facultyNo}</p></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Sessional marks">
          {student.marks.length === 0 ? <Empty>No released marks yet.</Empty> : (
            <div className="space-y-3">{student.marks.map((mark) => {
              const combined = combinedSessional(mark.sessional1, mark.sessional2, mark.subject.combinedRule);
              const warning = marksWarning(student.programme.level, mark.sessional1, mark.sessional2, mark.subject.sessionalMax);
              return <div key={mark.id} className="rounded-xl border border-white/10 p-4"><div className="flex justify-between gap-3"><p className="font-semibold">{mark.subject.name}</p>{warning && <span className="text-xs font-semibold text-amber-300">Below 15/30</span>}</div><p className="mt-3 text-sm text-slate-300">Sessional 1: {mark.sessional1 ?? "No data"} · Sessional 2: {mark.sessional2 ?? "No data"}</p><p className="mt-1 text-sm text-slate-400">Combined ({mark.subject.combinedRule.toLowerCase()}): {combined ?? "No data"}</p></div>;
            })}</div>
          )}
        </Panel>
        <Panel title="Attendance">
          {attendanceBySubject.size === 0 ? <Empty>No attendance sessions have been recorded.</Empty> : (
            <div className="space-y-3">{Array.from(attendanceBySubject, ([subjectId, rows]) => {
              const summary = attendanceSummary(rows.map((row) => row.status), false);
              const latest = rows[0];
              return <div key={subjectId} className="rounded-xl border border-white/10 p-4"><div className="flex justify-between gap-3"><p className="font-semibold">{latest.subject.name}</p><p className="font-semibold text-cyan-300">{summary.percentage === null ? "No data" : `${summary.percentage.toFixed(1)}%`}</p></div><p className="mt-2 text-sm text-slate-400">{summary.attended} of {summary.counted} counted sessions · {latest.source.kind === "GOOGLE_SHEET" ? "Google Sheets" : "Excel"}</p><p className="mt-1 text-xs text-slate-500">Last source update: {latest.source.lastSuccess?.toLocaleDateString("en-IN") ?? "Not confirmed"}. Attendance alerts await a confirmed freshness rule.</p></div>;
            })}</div>
          )}
        </Panel>
      </div>
      <Panel title="Notices">{student.notices.length === 0 ? <Empty>No notices yet.</Empty> : <ul className="space-y-3">{student.notices.map((notice) => <li key={notice.id} className="border-b border-white/10 pb-3 text-sm"><p>{notice.message}</p><p className="mt-1 text-xs text-slate-500">{notice.createdAt.toLocaleDateString("en-IN")}</p></li>)}</ul>}</Panel>
    </div>
  );
}

async function TeacherView({ role }: { role: DashboardRole & { kind: "TEACHER" } }) {
  const teacher = await getDb().teacher.findUnique({ where: { id: role.id }, include: { department: true, assignments: { include: { subject: true, term: true, sources: { where: { active: true }, take: 1 } } } } });
  if (!teacher) return <Empty>Teacher record unavailable.</Empty>;
  return <div className="space-y-6"><div><Link href="/dashboard/import" className="inline-flex rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220] hover:bg-cyan-300">Manage imports</Link></div><Panel title="Assigned teaching groups">{teacher.assignments.length === 0 ? <Empty>No subject assignment yet.</Empty> : <div className="grid gap-3 md:grid-cols-2">{teacher.assignments.map((assignment) => <div key={assignment.id} className="rounded-xl border border-white/10 p-4"><p className="font-semibold">{assignment.subject.name}</p><p className="mt-2 text-sm text-slate-400">{assignment.term.label} · Section {assignment.section}</p><p className="mt-2 text-xs text-cyan-300">Attendance: {assignment.sources[0] ? assignment.sources[0].kind === "GOOGLE_SHEET" ? "Google Sheets" : "Excel" : "Source not selected"}</p></div>)}</div>}</Panel><Panel title="Department"><p className="text-sm text-slate-300">{teacher.department.name}</p><p className="mt-2 text-xs text-slate-500">Only assigned subject records may be changed. Cross-subject student results will be read-only.</p></Panel></div>;
}

async function HodView({ role }: { role: DashboardRole & { kind: "HOD" } }) {
  const hod = await getDb().hOD.findUnique({ where: { id: role.id }, include: { department: { include: { programmes: true } } } });
  if (!hod) return <Empty>HOD record unavailable.</Empty>;
  return <Panel title="Department overview"><Link href="/dashboard/hod" className="mb-5 inline-flex rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220] hover:bg-cyan-300">Manage teaching assignments</Link><p className="text-xl font-semibold">{hod.department.name}</p><p className="mt-2 text-sm text-slate-400">{hod.department.programmes.length} programme(s) in scope</p><div className="mt-5 space-y-2">{hod.department.programmes.map((programme) => <p key={programme.id} className="rounded-lg border border-white/10 p-3 text-sm">{programme.code} · {programme.name} · {programme.level}</p>)}</div></Panel>;
}

async function AdminView() {
  const db = getDb();
  const [students, teachers, hods, admins] = await Promise.all([db.student.count(), db.teacher.count(), db.hOD.count(), db.admin.count()]);
  return <Panel title="Provisioned role records"><div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[["Students", students], ["Teachers", teachers], ["HODs", hods], ["Admins", admins]].map(([label, count]) => <div key={label} className="rounded-xl border border-white/10 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold text-cyan-300">{count}</p></div>)}</div><Link href="/dashboard/admin" className="mt-5 inline-flex rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220] hover:bg-cyan-300">Manage accounts</Link><p className="mt-4 text-sm text-slate-400">Admin access does not grant permission to edit academic records.</p></Panel>;
}

export default async function Dashboard() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !process.env.DATABASE_URL) {
    return <main className="grid min-h-screen place-items-center bg-[#0a1220] px-6 text-slate-100"><div className="max-w-lg rounded-2xl border border-amber-300/30 bg-[#101e30] p-8"><h1 className="text-2xl font-semibold">Local setup needed</h1><p className="mt-4 text-sm leading-6 text-slate-300">Add Supabase and PostgreSQL values from <code>.env.example</code> to <code>.env.local</code>, then apply the Prisma migration. The dashboard does not display fabricated academic records.</p><Link href="/" className="mt-6 inline-block text-cyan-300 hover:underline">Back to overview</Link></div></main>;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  const role = await roleForAuthUser(data.claims.sub);
  return <main className="min-h-screen bg-[#0a1220] text-slate-100"><div className="mx-auto max-w-7xl px-6 py-8 sm:px-10"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-6"><div><Link href="/" className="text-sm font-bold tracking-wide text-cyan-300">G7 / ACADEMIC PERFORMANCE</Link><h1 className="mt-2 text-3xl font-semibold">{role ? `Welcome, ${role.name}` : "Account pending"}</h1><p className="mt-1 text-sm text-slate-400">{role?.kind ?? "No dashboard role assigned"}</p></div><form action={signOut}><button className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Sign out</button></form></header><div className="py-8">{!role ? <Empty>Your sign-in works, but an administrator has not assigned a dashboard role yet.</Empty> : role.kind === "STUDENT" ? <StudentView role={role} /> : role.kind === "TEACHER" ? <TeacherView role={role} /> : role.kind === "HOD" ? <HodView role={role} /> : <AdminView />}</div></div></main>;
}
