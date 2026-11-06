import { monthlyAttendanceTrend } from "@/lib/student-progress";

export type SubjectProgress = {
  key: string;
  subject: string;
  term: string;
  sessional1: number | null;
  sessional2: number | null;
  combined: number | null;
  combinedRule: "SUM" | "AVERAGE";
  combinedMaximum: number;
  attendancePercentage: number | null;
  attended: number;
  counted: number;
  marksWarning: boolean;
  attendanceWarning: boolean;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const percent = (value: number | null) => value === null ? "No data" : `${value.toFixed(1)}%`;

export function StudentProgress({ subjects, reports }: {
  subjects: SubjectProgress[];
  reports: { month: string; summary: unknown }[];
}) {
  const trend = monthlyAttendanceTrend(reports).slice(-6);
  const alerts = subjects.flatMap((item) => [
    ...(item.marksWarning ? [`${item.subject}: a sessional mark is below 15/30.`] : []),
    ...(item.attendanceWarning ? [`${item.subject}: recorded attendance is below 30%.`] : []),
  ]);
  const points = trend.map((item, index) => ({
    ...item,
    x: trend.length === 1 ? 240 : 56 + index * (368 / (trend.length - 1)),
    y: 130 - item.percentage * 1.1,
  }));

  return <section className="mt-8 space-y-6" aria-labelledby="student-progress-title">
    <div><h2 id="student-progress-title" className="text-2xl font-semibold">Academic progress</h2><p className="mt-2 text-sm text-slate-400">Current figures use released marks and attendance. Monthly trends come from saved reports.</p></div>
    {alerts.length > 0 && <div role="alert" className="rounded-2xl border border-amber-300/40 bg-amber-300/10 p-5"><h3 className="font-semibold text-amber-200">Needs attention</h3><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-100">{alerts.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h3 className="text-lg font-semibold">Marks and attendance by subject</h3><p className="mt-1 text-xs text-slate-400">Bar lengths show the percentage of the applicable maximum. Raw figures remain below each chart.</p>
        {subjects.length === 0 ? <p className="mt-5 text-sm text-slate-400">No subjects have been assigned yet.</p> : <div className="mt-5 space-y-5">{subjects.map((item) => {
          const markPercentage = item.combined === null || item.combinedMaximum <= 0 ? null : clamp(item.combined / item.combinedMaximum * 100);
          return <div key={item.key} className="rounded-xl border border-white/10 p-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold">{item.subject}</p><span className="text-xs text-slate-400">{item.term}</span></div>
            <div className="mt-4 space-y-3"><div><div className="mb-1 flex justify-between text-xs"><span>Combined sessionals</span><span>{item.combined === null ? "No data" : `${item.combined} / ${item.combinedMaximum}`}</span></div><div className="h-3 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${item.subject} combined marks: ${percent(markPercentage)}`}><div className="h-full rounded-full bg-cyan-300" style={{ width: `${markPercentage ?? 0}%` }} /></div></div>
              <div><div className="mb-1 flex justify-between text-xs"><span>Attendance</span><span>{percent(item.attendancePercentage)}</span></div><div className="h-3 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${item.subject} attendance: ${percent(item.attendancePercentage)}`}><div className="h-full rounded-full bg-violet-400" style={{ width: `${clamp(item.attendancePercentage ?? 0)}%` }} /></div></div></div>
            <p className="mt-3 text-xs text-slate-400">Sessional 1: {item.sessional1 ?? "missing"} · Sessional 2: {item.sessional2 ?? "missing"} · Combined: {item.combined ?? "missing"} ({item.combinedRule.toLowerCase()})</p><p className="mt-1 text-xs text-slate-400">Attendance: {item.attended} of {item.counted} counted sessions</p>
          </div>;
        })}</div>}
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h3 className="text-lg font-semibold">Monthly attendance trend</h3><p className="mt-1 text-xs text-slate-400">Up to six months with recorded attendance. Each point combines counted sessions across subjects.</p>
        {points.length === 0 ? <p className="mt-5 text-sm text-slate-400">A trend appears after the first month-end report with attendance data.</p> : <><svg className="mt-5 w-full" viewBox="0 0 480 180" role="img" aria-label={`Monthly attendance trend: ${points.map((item) => `${item.month} ${percent(item.percentage)}`).join(", ")}`}>
          {[20, 75, 130].map((y) => <line key={y} x1="52" x2="432" y1={y} y2={y} stroke="#334155" strokeWidth="1" />)}
          <text x="8" y="24" fill="#94a3b8" fontSize="12">100</text><text x="16" y="79" fill="#94a3b8" fontSize="12">50</text><text x="24" y="134" fill="#94a3b8" fontSize="12">0</text>
          {points.length > 1 && <polyline points={points.map((item) => `${item.x},${item.y}`).join(" ")} fill="none" stroke="#67e8f9" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
          {points.map((item) => <g key={item.month}><circle cx={item.x} cy={item.y} r="5" fill="#67e8f9" /><text x={item.x} y="161" textAnchor="middle" fill="#cbd5e1" fontSize="11">{item.month.slice(5)}</text></g>)}
        </svg><ul className="mt-2 space-y-1 text-xs text-slate-300">{points.map((item) => <li key={item.month}>{item.month}: {percent(item.percentage)} ({item.attended}/{item.counted} sessions)</li>)}</ul></>}
      </div>
    </div>
  </section>;
}
