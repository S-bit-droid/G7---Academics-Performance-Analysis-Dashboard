"use server";

import { revalidatePath } from "next/cache";
import { formatAcademicTime, parseAcademicLocalTime } from "@/lib/academic-time";
import { getDb } from "@/lib/db";
import { requireHod } from "@/lib/hod-access";
import { storePrivateFile } from "@/lib/private-files";
import { hodCanAssignTeacher } from "@/lib/teaching-scope";

export type AssignmentState = { message: string; ok: boolean };

export async function assignTeachingGroup(_previous: AssignmentState, formData: FormData): Promise<AssignmentState> {
  const hod = await requireHod();

  const teacherId = String(formData.get("teacherId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const termId = String(formData.get("termId") ?? "");
  const section = String(formData.get("section") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,20}$/.test(section)) return { ok: false, message: "Enter a section using up to 20 letters, numbers or hyphens." };

  const db = getDb();
  const [teacher, subject, term] = await Promise.all([
    db.teacher.findUnique({ where: { id: teacherId } }),
    db.subject.findUnique({ where: { id: subjectId }, include: { programme: true } }),
    db.term.findUnique({ where: { id: termId } }),
  ]);
  if (!hod || !teacher || !subject || !term) return { ok: false, message: "Select an existing Teacher, subject and term." };
  if (!hodCanAssignTeacher({
    hodDepartmentId: hod.departmentId,
    teacherDepartmentId: teacher.departmentId,
    subjectDepartmentId: subject.programme.departmentId,
    subjectProgrammeId: subject.programmeId,
    termProgrammeId: term.programmeId,
  })) return { ok: false, message: "This teaching group is outside your department or programme." };

  await db.teachingAssignment.upsert({
    where: { teacherId_subjectId_termId_section: { teacherId, subjectId, termId, section } },
    create: { teacherId, subjectId, termId, section }, update: {},
  });
  revalidatePath("/dashboard/hod");
  revalidatePath("/dashboard");
  return { ok: true, message: "Teacher assigned to the teaching group." };
}

export async function issueTimetable(formData: FormData) {
  const hod = await requireHod();
  const programmeId = String(formData.get("programmeId") ?? "");
  const termId = String(formData.get("termId") ?? "");
  const section = String(formData.get("section") ?? "").trim().toUpperCase();
  const title = String(formData.get("title") ?? "").trim();
  const file = formData.get("file");
  if (!/^[A-Z0-9-]{1,20}$/.test(section) || !title || title.length > 120) throw new Error("Enter a section and timetable title.");
  if (!(file instanceof File) || file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Choose a PDF timetable.");
  const db = getDb();
  const [programme, term] = await Promise.all([
    db.programme.findUnique({ where: { id: programmeId } }),
    db.term.findUnique({ where: { id: termId } }),
  ]);
  if (!programme || programme.departmentId !== hod.departmentId || !term || term.programmeId !== programmeId) throw new Error("Timetable scope must be in your department.");
  const assignedGroup = await db.teachingAssignment.findFirst({ where: { termId, section, subject: { programmeId } }, select: { id: true } });
  if (!assignedGroup) throw new Error("Assign a Teacher to this programme, term and section before issuing its timetable.");
  const storagePath = await storePrivateFile(file, `timetables/${hod.departmentId}`);
  const timetable = await db.timetable.create({ data: {
    departmentId: hod.departmentId, programmeId, termId, section, title, storagePath, issuedByAuthId: hod.authUserId,
  } });
  const enrolments = await db.enrolment.findMany({ where: { termId, section, subject: { programmeId } }, select: { studentId: true }, distinct: ["studentId"] });
  if (enrolments.length) await db.notification.createMany({ data: enrolments.map(({ studentId }) => ({
    studentId, type: "TIMETABLE", message: `New timetable: ${title}`, dedupeKey: `timetable:${timetable.id}:${studentId}`,
  })), skipDuplicates: true });
  revalidatePath("/dashboard/hod");
  revalidatePath("/dashboard/student");
  revalidatePath("/dashboard/teacher");
}

export async function saveDepartmentEvent(formData: FormData) {
  const hod = await requireHod();
  const eventId = String(formData.get("eventId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const startsAt = parseAcademicLocalTime(String(formData.get("startsAt") ?? ""));
  if (!title || title.length > 120 || !startsAt || !["DEPARTMENT", "SEMINAR", "SESSIONAL"].includes(kind)) {
    throw new Error("Enter a valid event title, type and time.");
  }
  const db = getDb();
  if (eventId) {
    const existing = await db.calendarEvent.findUnique({ where: { id: eventId } });
    if (!existing || existing.departmentId !== hod.departmentId || existing.createdByAuthId !== hod.authUserId || existing.subjectId) throw new Error("You cannot edit this calendar item.");
    await db.$transaction([
      db.calendarEvent.update({ where: { id: eventId }, data: { title, kind: kind as "DEPARTMENT" | "SEMINAR" | "SESSIONAL", startsAt } }),
      db.notification.updateMany({ where: { eventId }, data: { message: `${title} · ${formatAcademicTime(startsAt)}` } }),
    ]);
  } else {
    const event = await db.calendarEvent.create({ data: { title, kind: kind as "DEPARTMENT" | "SEMINAR" | "SESSIONAL", startsAt, departmentId: hod.departmentId, createdByAuthId: hod.authUserId } });
    const students = await db.student.findMany({ where: { programme: { departmentId: hod.departmentId } }, select: { id: true } });
    if (students.length) await db.notification.createMany({ data: students.map(({ id }) => ({
      studentId: id, eventId: event.id, type: "CALENDAR", message: `${title} · ${formatAcademicTime(startsAt)}`, dedupeKey: `event:${event.id}:${id}`,
    })), skipDuplicates: true });
  }
  revalidatePath("/dashboard/hod");
  revalidatePath("/dashboard/student");
  revalidatePath("/dashboard/teacher");
}
