"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { formatAcademicTime, parseAcademicDate, parseAcademicLocalTime } from "@/lib/academic-time";
import { storePrivateFile } from "@/lib/private-files";
import { parseQuizQuestions } from "@/lib/quiz";
import { requireTeacher, requireTeachingGroup } from "@/lib/teacher-access";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
function back(id: string, message: string, error = false): never {
  redirect(`/dashboard/teacher/${id}?${error ? "error" : "ok"}=${encodeURIComponent(message)}`);
}
function dateValue(raw: string) {
  return parseAcademicLocalTime(raw);
}

async function notifyGroup(group: { subjectId: string; termId: string; section: string }, key: string, message: string) {
  const db = getDb();
  const students = await db.enrolment.findMany({ where: {
    subjectId: group.subjectId, termId: group.termId, section: group.section,
  }, select: { studentId: true } });
  if (students.length) await db.notification.createMany({ data: students.map(({ studentId }) => ({
    studentId, type: "ACADEMIC", message, dedupeKey: `${key}:${studentId}`,
  })), skipDuplicates: true });
}

export async function setCombinedRule(form: FormData) {
  const id = value(form, "assignmentId");
  const { group } = await requireTeachingGroup(id);
  const rule = value(form, "rule");
  if (rule !== "SUM" && rule !== "AVERAGE") back(id, "Choose sum or average.", true);
  await getDb().subject.update({ where: { id: group.subjectId }, data: { combinedRule: rule } });
  revalidatePath("/dashboard");
  back(id, "Combined sessional rule saved.");
}

export async function createQuiz(form: FormData) {
  const id = value(form, "assignmentId");
  const { teacher, group } = await requireTeachingGroup(id);
  const title = value(form, "title");
  const minutes = Number(value(form, "minutes"));
  const availabilityMinutes = Number(value(form, "availabilityMinutes"));
  const attendanceOn = parseAcademicDate(value(form, "attendanceOn"));
  const attendanceSessionNo = Number(value(form, "attendanceSessionNo"));
  if (!title || title.length > 120) back(id, "Enter a quiz title up to 120 characters.", true);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) back(id, "Set a timer between 1 and 60 minutes.", true);
  if (!Number.isInteger(availabilityMinutes) || availabilityMinutes < minutes || availabilityMinutes > 180) back(id, "Availability must be at least the quiz timer and at most 180 minutes.", true);
  if (!attendanceOn) back(id, "Choose the class attendance date for this quiz.", true);
  if (!Number.isInteger(attendanceSessionNo) || attendanceSessionNo < 1 || attendanceSessionNo > 20) back(id, "Choose a class session number from 1 to 20.", true);
  let questions;
  try { questions = parseQuizQuestions(value(form, "questions")); }
  catch (error) { back(id, error instanceof Error ? error.message : "Invalid questions.", true); }
  const quiz = await getDb().quiz.create({ data: {
    teacherId: teacher.teacherId, subjectId: group.subjectId, termId: group.termId, section: group.section,
    title, timerSeconds: minutes * 60, questions, publishedAt: new Date(),
    availableUntil: new Date(Date.now() + availabilityMinutes * 60_000),
    attendanceOn,
    attendanceSessionNo,
  } });
  await notifyGroup(group, `quiz:${quiz.id}`, `New quiz: ${title} (${minutes} minutes)`);
  revalidatePath(`/dashboard/teacher/${id}`);
  back(id, "Quiz published for this teaching group.");
}

export async function closeQuiz(form: FormData) {
  const id = value(form, "assignmentId");
  const { teacher, group } = await requireTeachingGroup(id);
  const quizId = value(form, "quizId");
  const updated = await getDb().quiz.updateMany({ where: {
    id: quizId, teacherId: teacher.teacherId, subjectId: group.subjectId,
    termId: group.termId, section: group.section,
  }, data: { availableUntil: new Date() } });
  if (!updated.count) back(id, "Quiz not found in this class.", true);
  revalidatePath(`/dashboard/teacher/${id}`);
  back(id, "Quiz closed to new attempts.");
}

export async function uploadMaterial(form: FormData) {
  const id = value(form, "assignmentId");
  const { group } = await requireTeachingGroup(id);
  const title = value(form, "title");
  const description = value(form, "description");
  const kind = value(form, "kind");
  const dueAt = value(form, "dueAt") ? dateValue(value(form, "dueAt")) : null;
  const file = form.get("file");
  if (!title || title.length > 120 || description.length > 1000) back(id, "Check the title and description lengths.", true);
  if (kind !== "NOTE" && kind !== "ASSIGNMENT") back(id, "Choose notes or assignment.", true);
  if (kind === "ASSIGNMENT" && !dueAt) back(id, "Add a valid assignment deadline.", true);
  if (!(file instanceof File)) back(id, "Choose a file to upload.", true);
  let storagePath: string;
  try { storagePath = await storePrivateFile(file, `materials/${id}`); }
  catch (error) { back(id, error instanceof Error ? error.message : "Upload failed.", true); }
  const material = await getDb().teachingMaterial.create({ data: { assignmentId: id, kind, title, description: description || null, dueAt, storagePath } });
  await notifyGroup(group, `material:${material.id}`, `${kind === "NOTE" ? "New notes" : "New assignment"}: ${title}`);
  revalidatePath(`/dashboard/teacher/${id}`);
  back(id, `${kind === "NOTE" ? "Notes" : "Assignment"} uploaded.`);
}

export async function createSubjectEvent(form: FormData) {
  const id = value(form, "assignmentId");
  const { teacher, group } = await requireTeachingGroup(id);
  const kind = value(form, "kind");
  const title = value(form, "title");
  const startsAt = dateValue(value(form, "startsAt"));
  if (kind !== "SESSIONAL" && kind !== "ASSIGNMENT" && kind !== "QUIZ") back(id, "Choose an event type.", true);
  if (!title || title.length > 120 || !startsAt) back(id, "Enter a title and valid date.", true);
  const db = getDb();
  const event = await db.calendarEvent.create({ data: {
    title, kind, startsAt, createdByAuthId: teacher.authUserId,
    subjectId: group.subjectId, termId: group.termId, section: group.section,
  } });
  const enrolments = await db.enrolment.findMany({ where: { subjectId: group.subjectId, termId: group.termId, section: group.section }, select: { studentId: true } });
  await db.notification.createMany({ data: enrolments.map(({ studentId }) => ({
    studentId, eventId: event.id, type: "CALENDAR", message: `${title} · ${formatAcademicTime(startsAt)}`,
    dedupeKey: `event:${event.id}:${studentId}`,
  })), skipDuplicates: true });
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/teacher/${id}`);
  back(id, "Calendar item published to this class.");
}

export async function updateSubjectEvent(form: FormData) {
  const id = value(form, "assignmentId");
  const { teacher, group } = await requireTeachingGroup(id);
  const eventId = value(form, "eventId");
  const event = await getDb().calendarEvent.findUnique({ where: { id: eventId } });
  if (!event || event.createdByAuthId !== teacher.authUserId || event.subjectId !== group.subjectId || event.termId !== group.termId || event.section !== group.section) back(id, "This calendar item cannot be edited.", true);
  const title = value(form, "title");
  const startsAt = dateValue(value(form, "startsAt"));
  if (!title || title.length > 120 || !startsAt) back(id, "Enter a title and valid date.", true);
  const db = getDb();
  await db.$transaction([
    db.calendarEvent.update({ where: { id: eventId }, data: { title, startsAt } }),
    db.notification.updateMany({ where: { eventId }, data: { message: `${title} · ${formatAcademicTime(startsAt)}` } }),
  ]);
  revalidatePath("/dashboard");
  back(id, "Calendar item updated.");
}

export async function replyToStudent(form: FormData) {
  const teacher = await requireTeacher();
  const threadId = value(form, "threadId");
  const message = value(form, "message");
  const close = value(form, "close") === "yes";
  const thread = await getDb().questionThread.findUnique({ where: { id: threadId }, include: { student: true } });
  if (!thread || thread.teacherId !== teacher.teacherId) redirect("/dashboard/teacher");
  const [groups, enrolments] = await Promise.all([
    getDb().teachingAssignment.findMany({ where: { teacherId: teacher.teacherId, subjectId: thread.subjectId } }),
    getDb().enrolment.findMany({ where: { studentId: thread.studentId, subjectId: thread.subjectId } }),
  ]);
  if (!groups.some((group) => enrolments.some((row) => row.termId === group.termId && row.section === group.section))) {
    redirect("/dashboard/teacher");
  }
  if (!message || message.length > 2000) redirect("/dashboard/teacher?error=Enter+a+reply+up+to+2000+characters");
  const db = getDb();
  await db.$transaction([
    db.questionMessage.create({ data: { threadId, authorAuthId: teacher.authUserId, body: message } }),
    db.questionThread.update({ where: { id: threadId }, data: { status: close ? "CLOSED" : "REPLIED" } }),
  ]);
  revalidatePath("/dashboard/teacher");
  redirect("/dashboard/teacher?ok=Reply+sent");
}
