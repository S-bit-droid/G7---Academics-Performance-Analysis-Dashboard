"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { storePrivateFile } from "@/lib/private-files";
import { isQuizQuestions, quizScore } from "@/lib/quiz";
import { requireStudent } from "@/lib/student-access";

const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
function back(message: string, error = false): never {
  redirect(`/dashboard/student?${error ? "error" : "ok"}=${encodeURIComponent(message)}`);
}

export async function saveAcademicProfile(form: FormData) {
  const student = await requireStudent();
  const highSchool = field(form, "highSchool");
  const intermediate = field(form, "intermediate");
  const bachelors = field(form, "bachelors");
  const branch = field(form, "branch");
  const interests = field(form, "interests").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
  if (!highSchool || !intermediate || !branch || (student.programme.level === "PG" && !bachelors)) back("Complete the required academic background fields.", true);
  if ([highSchool, intermediate, bachelors, branch].some((item) => item.length > 160) || interests.some((item) => item.length > 80)) back("Profile fields are too long.", true);
  await getDb().student.update({ where: { id: student.id }, data: {
    highSchool: highSchool || null, intermediate: intermediate || null,
    bachelors: student.programme.level === "PG" ? bachelors || null : null,
    branch: branch || null, interests,
  } });
  revalidatePath("/dashboard/student");
  back("Academic background saved.");
}

export async function addStudentWork(form: FormData) {
  const student = await requireStudent();
  const kind = field(form, "kind");
  const title = field(form, "title");
  const description = field(form, "description");
  const link = field(form, "url");
  const file = form.get("file");
  if (!["RESUME", "CERTIFICATION", "SCHOLARSHIP", "PROJECT", "OTHER"].includes(kind)) back("Choose an item type.", true);
  if (!title || title.length > 120 || description.length > 1000) back("Check the title and description lengths.", true);
  if (link && (!/^https:\/\//i.test(link) || link.length > 500)) back("Links must use HTTPS and be under 500 characters.", true);
  if (kind === "RESUME" && (!(file instanceof File) || !file.size)) back("Choose a resume file.", true);
  let storagePath: string | null = null;
  if (file instanceof File && file.size) {
    try { storagePath = await storePrivateFile(file, `student-work/${student.id}`); }
    catch (error) { back(error instanceof Error ? error.message : "Upload failed.", true); }
  }
  await getDb().studentWork.create({ data: { studentId: student.id, kind, title, description: description || null, url: link || null, storagePath } });
  revalidatePath("/dashboard/student");
  back("Item saved to your profile.");
}

export async function updateStudentWork(form: FormData) {
  const student = await requireStudent();
  const id = field(form, "workId");
  const title = field(form, "title");
  const description = field(form, "description");
  const link = field(form, "url");
  if (!title || title.length > 120 || description.length > 1000) back("Check the title and description lengths.", true);
  if (link && (!/^https:\/\//i.test(link) || link.length > 500)) back("Links must use HTTPS and be under 500 characters.", true);
  const updated = await getDb().studentWork.updateMany({
    where: { id, studentId: student.id },
    data: { title, description: description || null, url: link || null },
  });
  if (!updated.count) back("Item not found in your profile.", true);
  revalidatePath("/dashboard/student");
  back("Profile item updated.");
}

export async function submitAssignment(form: FormData) {
  const student = await requireStudent();
  const materialId = field(form, "materialId");
  const material = await getDb().teachingMaterial.findUnique({ where: { id: materialId }, include: { assignment: true } });
  if (!material || material.kind !== "ASSIGNMENT") back("Assignment not found.", true);
  const enrolment = await getDb().enrolment.findFirst({ where: {
    studentId: student.id, subjectId: material.assignment.subjectId,
    termId: material.assignment.termId, section: material.assignment.section,
  } });
  if (!enrolment) back("This assignment is outside your class.", true);
  if (material.dueAt && new Date() > material.dueAt) back("The assignment deadline has passed.", true);
  const file = form.get("file");
  if (!(file instanceof File)) back("Choose a submission file.", true);
  let storagePath: string;
  try { storagePath = await storePrivateFile(file, `submissions/${student.id}`); }
  catch (error) { back(error instanceof Error ? error.message : "Upload failed.", true); }
  await getDb().assignmentSubmission.upsert({
    where: { materialId_studentId: { materialId, studentId: student.id } },
    create: { materialId, studentId: student.id, storagePath },
    update: { storagePath, submittedAt: new Date() },
  });
  revalidatePath("/dashboard/student");
  back("Assignment submitted.");
}

export async function sendAcademicFeedback(form: FormData) {
  const student = await requireStudent();
  const assignmentId = field(form, "assignmentId");
  const title = field(form, "title");
  const body = field(form, "body");
  if (!title || title.length > 120 || !body || body.length > 2000) back("Enter a short title and message.", true);
  const group = await getDb().teachingAssignment.findUnique({ where: { id: assignmentId } });
  if (!group) back("Choose an assigned Teacher.", true);
  const enrolment = await getDb().enrolment.findFirst({ where: {
    studentId: student.id, subjectId: group.subjectId, termId: group.termId, section: group.section,
  } });
  if (!enrolment) back("That Teacher is not assigned to your class.", true);
  await getDb().questionThread.create({ data: {
    studentId: student.id, teacherId: group.teacherId, subjectId: group.subjectId, title,
    messages: { create: { authorAuthId: student.authUserId, body } },
  } });
  revalidatePath("/dashboard/student");
  back("Your message was sent to the Teacher.");
}

export async function startQuiz(form: FormData) {
  const student = await requireStudent();
  const quizId = field(form, "quizId");
  const quiz = await getDb().quiz.findUnique({ where: { id: quizId } });
  if (!quiz || !quiz.publishedAt || !quiz.section || (quiz.availableUntil && quiz.availableUntil <= new Date())) back("This quiz is closed to new attempts.", true);
  const enrolled = await getDb().enrolment.findFirst({ where: {
    studentId: student.id, subjectId: quiz.subjectId, termId: quiz.termId, section: quiz.section,
  } });
  if (!enrolled) back("This quiz is outside your class.", true);
  const db = getDb();
  const attempt = await db.quizAttempt.upsert({
    where: { quizId_studentId: { quizId, studentId: student.id } },
    create: { quizId, studentId: student.id, lastSeenAt: new Date() },
    update: {},
  });
  redirect(`/dashboard/student/quiz/${attempt.id}`);
}

export async function submitQuiz(form: FormData) {
  const student = await requireStudent();
  const attemptId = field(form, "attemptId");
  const attempt = await getDb().quizAttempt.findUnique({ where: { id: attemptId }, include: { quiz: true } });
  if (!attempt || attempt.studentId !== student.id) redirect("/dashboard/student");
  if (attempt.submittedAt) redirect(`/dashboard/student/quiz/${attemptId}`);
  const questions = attempt.quiz.questions;
  if (!isQuizQuestions(questions)) redirect("/dashboard/student?error=Quiz+questions+are+invalid");
  const answers = questions.map((_, index) => {
    const raw = field(form, `q${index}`);
    return /^[0-3]$/.test(raw) ? Number(raw) : -1;
  });
  const deadline = attempt.startedAt.getTime() + attempt.quiz.timerSeconds * 1000;
  const timedOut = Date.now() > deadline + 5000;
  const submittedAt = new Date();
  await getDb().$transaction(async (tx) => {
    const before = await tx.quizAttempt.findUnique({ where: { id: attemptId }, select: { lastSeenAt: true } });
    const updated = await tx.quizAttempt.updateMany({ where: { id: attemptId, studentId: student.id, submittedAt: null }, data: {
      answers, score: timedOut ? 0 : quizScore(questions, answers), timedOut,
      submittedAt, lastSeenAt: submittedAt,
    } });
    const gapSeconds = before?.lastSeenAt ? Math.floor((submittedAt.getTime() - before.lastSeenAt.getTime()) / 1000) : 0;
    if (updated.count && gapSeconds >= 45) await tx.quizActivityEvent.create({ data: {
      attemptId, type: "CONTACT_GAP", durationSeconds: gapSeconds, receivedAt: submittedAt,
    } });
  });
  revalidatePath(`/dashboard/student/quiz/${attemptId}`);
  redirect(`/dashboard/student/quiz/${attemptId}`);
}
