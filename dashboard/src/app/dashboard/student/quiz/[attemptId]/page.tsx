import Link from "next/link";
import { getDb } from "@/lib/db";
import { isQuizQuestions } from "@/lib/quiz";
import { requireStudent } from "@/lib/student-access";
import { AttemptForm } from "./attempt-form";

export const dynamic = "force-dynamic";

export default async function QuizAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const student = await requireStudent();
  const { attemptId } = await params;
  const attempt = await getDb().quizAttempt.findFirst({ where: { id: attemptId, studentId: student.id }, include: { quiz: true } });
  if (!attempt) return <main className="min-h-screen bg-[#0a1220] p-8 text-slate-100">Quiz attempt unavailable.</main>;
  if (!isQuizQuestions(attempt.quiz.questions)) return <main className="min-h-screen bg-[#0a1220] p-8 text-slate-100">Quiz questions are unavailable.</main>;
  const deadline = attempt.startedAt.getTime() + attempt.quiz.timerSeconds * 1000;
  return <main className="min-h-screen bg-[#0a1220] px-6 py-8 text-slate-100"><div className="mx-auto max-w-3xl"><Link href="/dashboard/student" className="text-sm text-cyan-300">← Academic workspace</Link><h1 className="mt-6 text-3xl font-semibold">{attempt.quiz.title}</h1>
    {attempt.submittedAt ? <section className="mt-6 rounded-xl border border-white/10 bg-[#101e30] p-6"><p className="text-lg font-semibold">{attempt.timedOut ? "Time expired" : "Submitted"}</p><p className="mt-3 text-sm text-slate-300">Score: {attempt.score ?? "Pending"} / {attempt.quiz.questions.length}</p></section> :
      <><p className="mt-5 rounded-lg border border-white/10 p-3 text-sm text-slate-300">During this attempt, the dashboard records when this quiz page is hidden or left and when server contact is interrupted. Your Teacher can review the log. These events do not automatically change your score.</p><AttemptForm attemptId={attempt.id} deadline={deadline} questions={attempt.quiz.questions.map((question) => ({ prompt: question.prompt, options: question.options }))} /></>}
  </div></main>;
}
