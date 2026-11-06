import Link from "next/link";
import { getDb } from "@/lib/db";
import { privateFileUrl } from "@/lib/private-files";
import { requireTeacher } from "@/lib/teacher-access";
import { replyToStudent } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeacherPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const teacher = await requireTeacher();
  const db = getDb();
  const [groups, threads] = await Promise.all([
    db.teachingAssignment.findMany({ where: { teacherId: teacher.teacherId }, include: { subject: true, term: true }, orderBy: { subject: { name: "asc" } } }),
    db.questionThread.findMany({ where: { teacherId: teacher.teacherId }, include: { student: true, subject: true, messages: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const timetables = await db.timetable.findMany({ where: { OR: [...groups.map((group) => ({ programmeId: group.subject.programmeId, termId: group.termId, section: group.section })), { id: "__none__" }] }, orderBy: { issuedAt: "desc" }, take: 30 });
  const latestTimetables = timetables.filter((item, index) => timetables.findIndex((other) => other.programmeId === item.programmeId && other.termId === item.termId && other.section === item.section) === index);
  const timetableFiles = await Promise.all(latestTimetables.map(async (item) => ({ ...item, url: await privateFileUrl(item.storagePath) })));
  const { ok, error } = await searchParams;
  return <main className="min-h-screen bg-[#0a1220] px-6 py-8 text-slate-100"><div className="mx-auto max-w-6xl">
    <Link href="/dashboard" className="text-sm text-cyan-300">← Dashboard</Link>
    <h1 className="mt-6 text-3xl font-semibold">Teacher workspace</h1>
    <p className="mt-2 text-sm text-slate-400">Manage your assigned classes. Other subjects remain read-only when viewing an assigned Student.</p>
    {ok && <p role="status" className="mt-5 rounded-lg border border-emerald-400/30 p-3 text-sm text-emerald-200">{ok}</p>}
    {error && <p role="alert" className="mt-5 rounded-lg border border-rose-400/30 p-3 text-sm text-rose-200">{error}</p>}
    <div className="mt-8 grid gap-4 md:grid-cols-2">{groups.length === 0 ? <p className="text-sm text-slate-400">No teaching group is assigned yet. The HOD can assign one.</p> : groups.map((group) =>
      <Link key={group.id} href={`/dashboard/teacher/${group.id}`} className="rounded-2xl border border-white/10 bg-[#101e30] p-5 hover:border-cyan-300/50">
        <h2 className="text-lg font-semibold">{group.subject.name}</h2><p className="mt-2 text-sm text-slate-400">{group.term.label} · Section {group.section}</p><p className="mt-4 text-sm text-cyan-300">Open class →</p>
      </Link>)}</div>
    <section className="mt-8 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-xl font-semibold">Issued timetables</h2>{timetableFiles.length === 0 ? <p className="mt-3 text-sm text-slate-400">No timetable for your assigned classes yet.</p> : <div className="mt-4 space-y-2">{timetableFiles.map((item) => <p key={item.id} className="rounded-lg border border-white/10 p-3 text-sm">{item.title} · Section {item.section}{item.url && <a href={item.url} className="ml-3 text-cyan-300">Download PDF</a>}</p>)}</div>}</section>
    <section className="mt-10 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-xl font-semibold">Student questions and feedback</h2>
      {threads.length === 0 ? <p className="mt-4 text-sm text-slate-400">No threads yet.</p> : <div className="mt-5 space-y-5">{threads.map((thread) =>
        <article key={thread.id} className="rounded-xl border border-white/10 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{thread.title}</h3><span className="text-xs text-cyan-300">{thread.status}</span></div>
          <p className="mt-1 text-xs text-slate-400">{thread.student.name} · {thread.subject.name}</p>
          <div className="mt-4 space-y-2">{thread.messages.map((message) => <p key={message.id} className="rounded-lg bg-white/5 p-3 text-sm"><span className="mr-2 text-xs text-slate-400">{message.authorAuthId === teacher.authUserId ? "You" : thread.student.name}:</span>{message.body}</p>)}</div>
          <form action={replyToStudent} className="mt-4 space-y-2"><input type="hidden" name="threadId" value={thread.id} /><label className="block text-sm">Reply<textarea name="message" required maxLength={2000} rows={2} className="mt-1 w-full rounded-lg border border-white/20 bg-[#0a1220] p-3" /></label><label className="flex items-center gap-2 text-sm text-slate-300"><input name="close" type="checkbox" value="yes" /> Close after replying</label><button className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220]">Send reply</button></form>
        </article>)}</div>}
    </section>
  </div></main>;
}
