"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { StudentQuizService } from "@/lib/role-services/student-quiz-service";
import { StudentWorkspaceService } from "@/lib/role-services/student-workspace-service";
import { requireStudent } from "@/lib/student-access";

const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
function back(message: string, error = false): never {
  redirect(`/dashboard/student?${error ? "error" : "ok"}=${encodeURIComponent(message)}`);
}

async function workspace() {
  const student = await requireStudent();
  return new StudentWorkspaceService({ id: student.id, authUserId: student.authUserId, programmeLevel: student.programme.level });
}

async function finish(operation: () => Promise<void>, message: string): Promise<never> {
  try { await operation(); }
  catch (error) { back(error instanceof Error ? error.message : "The change could not be saved.", true); }
  revalidatePath("/dashboard/student");
  back(message);
}

export async function saveAcademicProfile(form: FormData) {
  const service = await workspace();
  return finish(() => service.saveAcademicProfile(form), "Academic background saved.");
}

export async function addStudentWork(form: FormData) {
  const service = await workspace();
  return finish(() => service.addWork(form), "Item saved to your profile.");
}

export async function updateStudentWork(form: FormData) {
  const service = await workspace();
  return finish(() => service.updateWork(form), "Profile item updated.");
}

export async function submitAssignment(form: FormData) {
  const service = await workspace();
  return finish(() => service.submitAssignment(form), "Assignment submitted.");
}

export async function sendAcademicFeedback(form: FormData) {
  const service = await workspace();
  return finish(() => service.sendFeedback(form), "Your message was sent to the Teacher.");
}

export async function startQuiz(form: FormData) {
  const student = await requireStudent();
  const quizId = field(form, "quizId");
  let attemptId: string;
  try { attemptId = await new StudentQuizService(student.id).start(quizId); }
  catch (error) { back(error instanceof Error ? error.message : "Quiz could not be started.", true); }
  redirect(`/dashboard/student/quiz/${attemptId}`);
}

export async function submitQuiz(form: FormData) {
  const student = await requireStudent();
  const attemptId = field(form, "attemptId");
  const result = await new StudentQuizService(student.id).submit(attemptId, form);
  if (result === "not-found") redirect("/dashboard/student");
  if (result === "invalid-questions") redirect("/dashboard/student?error=Quiz+questions+are+invalid");
  revalidatePath(`/dashboard/student/quiz/${attemptId}`);
  redirect(`/dashboard/student/quiz/${attemptId}`);
}
