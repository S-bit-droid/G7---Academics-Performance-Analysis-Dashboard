import type { Prisma } from "@/generated/prisma/client";

type SubjectSummary = {
  subject: string;
  marks: null | { sessional1: number | null; sessional2: number | null; combined: number | null; method: string };
  attendance: { attended: number; counted: number; percentage: number | null };
  quizzes: { title: string; score: number | null; timedOut: boolean }[];
};

function readSubjects(value: Prisma.JsonValue): SubjectSummary[] {
  if (!value || Array.isArray(value) || typeof value !== "object") return [];
  const subjects = value.subjects;
  if (!Array.isArray(subjects)) return [];
  return subjects.filter((item): item is SubjectSummary =>
    Boolean(item && typeof item === "object" && !Array.isArray(item) && typeof item.subject === "string"));
}

export function MonthlyReportCard({ month, summary }: { month: string; summary: Prisma.JsonValue }) {
  const subjects = readSubjects(summary);
  return <article className="rounded-xl border border-white/10 p-4">
    <h3 className="font-semibold">{month}</h3>
    {subjects.length === 0 ? <p className="mt-2 text-sm text-slate-400">No subject data was available for this report.</p> :
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{subjects.map((item, index) => <div key={`${item.subject}-${index}`} className="rounded-lg bg-white/5 p-3 text-sm">
        <p className="font-medium">{item.subject}</p>
        <p className="mt-2 text-slate-300">Sessionals: {item.marks?.sessional1 ?? "missing"} / {item.marks?.sessional2 ?? "missing"}</p>
        <p className="text-slate-300">Combined: {item.marks?.combined ?? "missing"}{item.marks && ` (${item.marks.method.toLowerCase()})`}</p>
        <p className="text-slate-300">Attendance: {item.attendance?.percentage == null ? "missing" : `${item.attendance.percentage.toFixed(1)}%`}</p>
        <p className="text-slate-300">Quizzes: {item.quizzes?.length ? item.quizzes.map((quiz) => `${quiz.title} ${quiz.score ?? "unscored"}${quiz.timedOut ? " (timed out)" : ""}`).join(", ") : "none recorded"}</p>
      </div>)}</div>}
  </article>;
}
