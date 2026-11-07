import "server-only";

import { parseAcademicDate } from "@/lib/academic-time";
import { getDb } from "@/lib/db";
import { parseQuizQuestions } from "@/lib/quiz";

type TeachingGroup = { subjectId: string; termId: string; section: string };
type QuizInput = {
  title: string;
  minutes: number;
  availabilityMinutes: number;
  attendanceDate: string;
  attendanceSessionNo: number;
  questions: string;
};

export class TeacherQuizService {
  constructor(
    private readonly teacherId: string,
    private readonly group: TeachingGroup,
    private readonly db = getDb(),
  ) {}

  private async notify(quizId: string, title: string, minutes: number) {
    const students = await this.db.enrolment.findMany({ where: this.group, select: { studentId: true } });
    if (students.length) await this.db.notification.createMany({ data: students.map(({ studentId }) => ({
      studentId, type: "ACADEMIC", message: `New quiz: ${title} (${minutes} minutes)`, dedupeKey: `quiz:${quizId}:${studentId}`,
    })), skipDuplicates: true });
  }

  async publish(input: QuizInput): Promise<string> {
    const { title, minutes, availabilityMinutes, attendanceSessionNo } = input;
    const attendanceOn = parseAcademicDate(input.attendanceDate);
    if (!title || title.length > 120) throw new Error("Enter a quiz title up to 120 characters.");
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) throw new Error("Set a timer between 1 and 60 minutes.");
    if (!Number.isInteger(availabilityMinutes) || availabilityMinutes < minutes || availabilityMinutes > 180) {
      throw new Error("Availability must be at least the quiz timer and at most 180 minutes.");
    }
    if (!attendanceOn) throw new Error("Choose the class attendance date for this quiz.");
    if (!Number.isInteger(attendanceSessionNo) || attendanceSessionNo < 1 || attendanceSessionNo > 20) {
      throw new Error("Choose a class session number from 1 to 20.");
    }
    const questions = parseQuizQuestions(input.questions);
    const quiz = await this.db.quiz.create({ data: {
      teacherId: this.teacherId, ...this.group,
      title, timerSeconds: minutes * 60, questions, publishedAt: new Date(),
      availableUntil: new Date(Date.now() + availabilityMinutes * 60_000),
      attendanceOn, attendanceSessionNo,
    } });
    await this.notify(quiz.id, title, minutes);
    return quiz.id;
  }

  async close(quizId: string): Promise<boolean> {
    const updated = await this.db.quiz.updateMany({ where: {
      id: quizId, teacherId: this.teacherId, ...this.group,
    }, data: { availableUntil: new Date() } });
    return updated.count > 0;
  }
}
