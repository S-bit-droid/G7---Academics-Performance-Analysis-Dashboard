import "server-only";

import { getDb } from "@/lib/db";
import { isQuizQuestions, quizScore } from "@/lib/quiz";

export class StudentQuizService {
  constructor(private readonly studentId: string, private readonly db = getDb()) {}

  async start(quizId: string): Promise<string> {
    const quiz = await this.db.quiz.findUnique({ where: { id: quizId } });
    if (!quiz || !quiz.publishedAt || !quiz.section || (quiz.availableUntil && quiz.availableUntil <= new Date())) {
      throw new Error("This quiz is closed to new attempts.");
    }
    const enrolled = await this.db.enrolment.findFirst({ where: {
      studentId: this.studentId, subjectId: quiz.subjectId, termId: quiz.termId, section: quiz.section,
    } });
    if (!enrolled) throw new Error("This quiz is outside your class.");
    const attempt = await this.db.quizAttempt.upsert({
      where: { quizId_studentId: { quizId, studentId: this.studentId } },
      create: { quizId, studentId: this.studentId, lastSeenAt: new Date() },
      update: {},
    });
    return attempt.id;
  }

  async submit(attemptId: string, form: FormData): Promise<"submitted" | "already-submitted" | "not-found" | "invalid-questions"> {
    const attempt = await this.db.quizAttempt.findUnique({ where: { id: attemptId }, include: { quiz: true } });
    if (!attempt || attempt.studentId !== this.studentId) return "not-found";
    if (attempt.submittedAt) return "already-submitted";
    const questions = attempt.quiz.questions;
    if (!isQuizQuestions(questions)) return "invalid-questions";
    const answers = questions.map((_, index) => {
      const raw = String(form.get(`q${index}`) ?? "").trim();
      return /^[0-3]$/.test(raw) ? Number(raw) : -1;
    });
    const deadline = attempt.startedAt.getTime() + attempt.quiz.timerSeconds * 1000;
    const timedOut = Date.now() > deadline + 5000;
    const submittedAt = new Date();
    await this.db.$transaction(async (tx) => {
      const before = await tx.quizAttempt.findUnique({ where: { id: attemptId }, select: { lastSeenAt: true } });
      const updated = await tx.quizAttempt.updateMany({ where: { id: attemptId, studentId: this.studentId, submittedAt: null }, data: {
        answers, score: timedOut ? 0 : quizScore(questions, answers), timedOut,
        submittedAt, lastSeenAt: submittedAt,
      } });
      const gapSeconds = before?.lastSeenAt ? Math.floor((submittedAt.getTime() - before.lastSeenAt.getTime()) / 1000) : 0;
      if (updated.count && gapSeconds >= 45) await tx.quizActivityEvent.create({ data: {
        attemptId, type: "CONTACT_GAP", durationSeconds: gapSeconds, receivedAt: submittedAt,
      } });
    });
    return "submitted";
  }
}
