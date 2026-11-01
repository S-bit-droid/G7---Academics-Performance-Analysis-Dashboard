import Link from "next/link";

const areas = [
  ["01", "Student progress", "Marks, attendance and academic activity in one place."],
  ["02", "Class insight", "Subject results and student comparisons for assigned teachers."],
  ["03", "Department view", "Coverage and performance summaries for academic review."],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a1220] text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8 sm:px-10">
        <header className="flex items-center justify-between border-b border-white/15 pb-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-cyan-400 text-sm font-black text-[#0a1220]">G7</div>
            <div><p className="text-sm font-semibold tracking-wide">Academic Performance</p><p className="text-xs text-slate-400">Analytics Dashboard</p></div>
          </div>
          <Link href="/login" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Sign in</Link>
        </header>

        <section className="grid gap-12 py-20 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:py-28">
          <div>
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Group 7 · CAMS1004</p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">A clearer view of academic progress.</h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Bring released marks, attendance and course activity into one view. Students see their own progress. Teachers and the HOD see only the records within their academic scope.</p>
            <Link href="/login" className="mt-9 inline-flex rounded-lg bg-cyan-400 px-6 py-3 font-semibold text-[#0a1220] hover:bg-cyan-300">Open dashboard <span aria-hidden="true" className="ml-3">→</span></Link>
          </div>
          <div className="rounded-3xl border border-cyan-300/20 bg-[#101e30] p-6 shadow-2xl shadow-cyan-950/30">
            <div className="flex items-center justify-between border-b border-white/10 pb-5"><span className="text-sm font-semibold">Academic view</span><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">Scoped access</span></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-5"><p className="text-xs text-slate-400">SESSIONALS</p><p className="mt-3 text-lg font-semibold">Separate and combined</p><p className="mt-3 text-sm text-slate-400">The teacher selects sum or average.</p></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-5"><p className="text-xs text-slate-400">ATTENDANCE</p><p className="mt-3 text-lg font-semibold">Source and freshness</p><p className="mt-3 text-sm text-slate-400">Google Sheets or Excel input.</p></div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 sm:col-span-2"><p className="text-xs text-slate-400">ACCESS</p><p className="mt-3 text-lg font-semibold">Student · Teacher · HOD · Admin</p><p className="mt-3 text-sm text-slate-400">Each role sees only its authorised information.</p></div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-t border-white/15 py-8 md:grid-cols-3">
          {areas.map(([number, title, description]) => (
            <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"><p className="text-xs font-bold text-cyan-300">{number}</p><h2 className="mt-7 text-xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{description}</p></div>
          ))}
        </section>
      </div>
    </main>
  );
}
