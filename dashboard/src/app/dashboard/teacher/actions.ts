"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TeacherQuizService } from "@/lib/role-services/teacher-quiz-service";
import { TeacherWorkspaceService } from "@/lib/role-services/teacher-workspace-service";
import { requireTeacher, requireTeachingGroup } from "@/lib/teacher-access";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
function back(id: string, message: string, error = false): never {
  redirect(`/dashboard/teacher/${id}?${error ? "error" : "ok"}=${encodeURIComponent(message)}`);
}

export async function setCombinedRule(form: FormData) {
  const id = value(form, "assignmentId");
  const { teacher, group } = await requireTeachingGroup(id);
  try { await new TeacherWorkspaceService(teacher).setCombinedRule(group, value(form, "rule")); }
  catch (error) { back(id, error instanceof Error ? error.message : "Rule could not be saved.", true); }
  revalidatePath("/dashboard");
  back(id, "Combined sessional rule saved.");
}

export async function createQuiz(form: FormData) {
  const id = value(form, "assignmentId");
  const { teacher, group } = await requireTeachingGroup(id);
  try { await new TeacherQuizService(teacher.teacherId, group).publish({
    title: value(form, "title"), minutes: Number(value(form, "minutes")),
    availabilityMinutes: Number(value(form, "availabilityMinutes")),
    attendanceDate: value(form, "attendanceOn"),
    attendanceSessionNo: Number(value(form, "attendanceSessionNo")),
    questions: value(form, "questions"),
  }); }
  catch (error) { back(id, error instanceof Error ? error.message : "Quiz could not be published.", true); }
  revalidatePath(`/dashboard/teacher/${id}`);
  back(id, "Quiz published for this teaching group.");
}

export async function closeQuiz(form: FormData) {
  const id = value(form, "assignmentId");
  const { teacher, group } = await requireTeachingGroup(id);
  if (!await new TeacherQuizService(teacher.teacherId, group).close(value(form, "quizId"))) back(id, "Quiz not found in this class.", true);
  revalidatePath(`/dashboard/teacher/${id}`);
  back(id, "Quiz closed to new attempts.");
}

export async function uploadMaterial(form: FormData) {
  const id = value(form, "assignmentId");
  const { teacher, group } = await requireTeachingGroup(id);
  let label: "Notes" | "Assignment";
  try { label = await new TeacherWorkspaceService(teacher).uploadMaterial(id, group, form); }
  catch (error) { back(id, error instanceof Error ? error.message : "Upload failed.", true); }
  revalidatePath(`/dashboard/teacher/${id}`);
  back(id, `${label} uploaded.`);
}

export async function createSubjectEvent(form: FormData) {
  const id = value(form, "assignmentId");
  const { teacher, group } = await requireTeachingGroup(id);
  try { await new TeacherWorkspaceService(teacher).createSubjectEvent(group, form); }
  catch (error) { back(id, error instanceof Error ? error.message : "Calendar item could not be saved.", true); }
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/teacher/${id}`);
  back(id, "Calendar item published to this class.");
}

export async function updateSubjectEvent(form: FormData) {
  const id = value(form, "assignmentId");
  const { teacher, group } = await requireTeachingGroup(id);
  try { await new TeacherWorkspaceService(teacher).updateSubjectEvent(group, form); }
  catch (error) { back(id, error instanceof Error ? error.message : "Calendar item could not be updated.", true); }
  revalidatePath("/dashboard");
  back(id, "Calendar item updated.");
}

export async function replyToStudent(form: FormData) {
  const teacher = await requireTeacher();
  try { await new TeacherWorkspaceService(teacher).replyToStudent(
    value(form, "threadId"), value(form, "message"), value(form, "close") === "yes",
  ); }
  catch (error) { redirect(`/dashboard/teacher?error=${encodeURIComponent(error instanceof Error ? error.message : "Reply could not be sent.")}`); }
  revalidatePath("/dashboard/teacher");
  redirect("/dashboard/teacher?ok=Reply+sent");
}
