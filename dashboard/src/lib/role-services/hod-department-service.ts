import "server-only";

import { formatAcademicTime, parseAcademicLocalTime } from "@/lib/academic-time";
import { getDb } from "@/lib/db";
import { storePrivateFile } from "@/lib/private-files";
import { hodCanAssignTeacher } from "@/lib/teaching-scope";

export class HodDepartmentService {
  constructor(
    private readonly departmentId: string,
    private readonly authUserId: string,
    private readonly db = getDb(),
  ) {}

  async assignTeachingGroup(input: { teacherId: string; subjectId: string; termId: string; section: string }) {
    const { teacherId, subjectId, termId, section } = input;
    if (!/^[A-Z0-9-]{1,20}$/.test(section)) return { ok: false, message: "Enter a section using up to 20 letters, numbers or hyphens." };
    const [teacher, subject, term] = await Promise.all([
      this.db.teacher.findUnique({ where: { id: teacherId } }),
      this.db.subject.findUnique({ where: { id: subjectId }, include: { programme: true } }),
      this.db.term.findUnique({ where: { id: termId } }),
    ]);
    if (!teacher || !subject || !term) return { ok: false, message: "Select an existing Teacher, subject and term." };
    if (!hodCanAssignTeacher({
      hodDepartmentId: this.departmentId,
      teacherDepartmentId: teacher.departmentId,
      subjectDepartmentId: subject.programme.departmentId,
      subjectProgrammeId: subject.programmeId,
      termProgrammeId: term.programmeId,
    })) return { ok: false, message: "This teaching group is outside your department or programme." };
    await this.db.teachingAssignment.upsert({
      where: { teacherId_subjectId_termId_section: { teacherId, subjectId, termId, section } },
      create: { teacherId, subjectId, termId, section }, update: {},
    });
    return { ok: true, message: "Teacher assigned to the teaching group." };
  }

  async issueTimetable(input: { programmeId: string; termId: string; section: string; title: string; file: FormDataEntryValue | null }) {
    const { programmeId, termId, section, title, file } = input;
    if (!/^[A-Z0-9-]{1,20}$/.test(section) || !title || title.length > 120) throw new Error("Enter a section and timetable title.");
    if (!(file instanceof File) || file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Choose a PDF timetable.");
    const [programme, term] = await Promise.all([
      this.db.programme.findUnique({ where: { id: programmeId } }),
      this.db.term.findUnique({ where: { id: termId } }),
    ]);
    if (!programme || programme.departmentId !== this.departmentId || !term || term.programmeId !== programmeId) {
      throw new Error("Timetable scope must be in your department.");
    }
    const assignedGroup = await this.db.teachingAssignment.findFirst({ where: { termId, section, subject: { programmeId } }, select: { id: true } });
    if (!assignedGroup) throw new Error("Assign a Teacher to this programme, term and section before issuing its timetable.");
    const storagePath = await storePrivateFile(file, `timetables/${this.departmentId}`);
    const timetable = await this.db.timetable.create({ data: {
      departmentId: this.departmentId, programmeId, termId, section, title, storagePath, issuedByAuthId: this.authUserId,
    } });
    const enrolments = await this.db.enrolment.findMany({ where: { termId, section, subject: { programmeId } }, select: { studentId: true }, distinct: ["studentId"] });
    if (enrolments.length) await this.db.notification.createMany({ data: enrolments.map(({ studentId }) => ({
      studentId, type: "TIMETABLE", message: `New timetable: ${title}`, dedupeKey: `timetable:${timetable.id}:${studentId}`,
    })), skipDuplicates: true });
  }

  async saveEvent(input: { eventId: string; title: string; kind: string; startsAt: string }) {
    const { eventId, title, kind } = input;
    const startsAt = parseAcademicLocalTime(input.startsAt);
    if (!title || title.length > 120 || !startsAt || !["DEPARTMENT", "SEMINAR", "SESSIONAL"].includes(kind)) {
      throw new Error("Enter a valid event title, type and time.");
    }
    const eventKind = kind as "DEPARTMENT" | "SEMINAR" | "SESSIONAL";
    if (eventId) {
      const existing = await this.db.calendarEvent.findUnique({ where: { id: eventId } });
      if (!existing || existing.departmentId !== this.departmentId || existing.createdByAuthId !== this.authUserId || existing.subjectId) {
        throw new Error("You cannot edit this calendar item.");
      }
      await this.db.$transaction([
        this.db.calendarEvent.update({ where: { id: eventId }, data: { title, kind: eventKind, startsAt } }),
        this.db.notification.updateMany({ where: { eventId }, data: { message: `${title} · ${formatAcademicTime(startsAt)}` } }),
      ]);
    } else {
      const event = await this.db.calendarEvent.create({ data: {
        title, kind: eventKind, startsAt, departmentId: this.departmentId, createdByAuthId: this.authUserId,
      } });
      const students = await this.db.student.findMany({ where: { programme: { departmentId: this.departmentId } }, select: { id: true } });
      if (students.length) await this.db.notification.createMany({ data: students.map(({ id }) => ({
        studentId: id, eventId: event.id, type: "CALENDAR", message: `${title} · ${formatAcademicTime(startsAt)}`, dedupeKey: `event:${event.id}:${id}`,
      })), skipDuplicates: true });
    }
  }
}
