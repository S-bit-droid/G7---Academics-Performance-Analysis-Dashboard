import "server-only";

import { formatAcademicTime, parseAcademicLocalTime } from "@/lib/academic-time";
import { getDb } from "@/lib/db";
import { storePrivateFile } from "@/lib/private-files";

type TeachingGroup = { subjectId: string; termId: string; section: string };
const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export class TeacherWorkspaceService {
  constructor(
    private readonly teacher: { teacherId: string; authUserId: string },
    private readonly db = getDb(),
  ) {}

  private async notifyGroup(group: TeachingGroup, key: string, message: string) {
    const students = await this.db.enrolment.findMany({ where: group, select: { studentId: true } });
    if (students.length) await this.db.notification.createMany({ data: students.map(({ studentId }) => ({
      studentId, type: "ACADEMIC", message, dedupeKey: `${key}:${studentId}`,
    })), skipDuplicates: true });
  }

  async setCombinedRule(group: TeachingGroup, rule: string) {
    if (rule !== "SUM" && rule !== "AVERAGE") throw new Error("Choose sum or average.");
    await this.db.subject.update({ where: { id: group.subjectId }, data: { combinedRule: rule } });
  }

  async uploadMaterial(assignmentId: string, group: TeachingGroup, form: FormData): Promise<"Notes" | "Assignment"> {
    const title = field(form, "title");
    const description = field(form, "description");
    const kind = field(form, "kind");
    const dueAt = field(form, "dueAt") ? parseAcademicLocalTime(field(form, "dueAt")) : null;
    const file = form.get("file");
    if (!title || title.length > 120 || description.length > 1000) throw new Error("Check the title and description lengths.");
    if (kind !== "NOTE" && kind !== "ASSIGNMENT") throw new Error("Choose notes or assignment.");
    if (kind === "ASSIGNMENT" && !dueAt) throw new Error("Add a valid assignment deadline.");
    if (!(file instanceof File)) throw new Error("Choose a file to upload.");
    const storagePath = await storePrivateFile(file, `materials/${assignmentId}`);
    const material = await this.db.teachingMaterial.create({ data: {
      assignmentId, kind, title, description: description || null, dueAt, storagePath,
    } });
    await this.notifyGroup(group, `material:${material.id}`, `${kind === "NOTE" ? "New notes" : "New assignment"}: ${title}`);
    return kind === "NOTE" ? "Notes" : "Assignment";
  }

  async createSubjectEvent(group: TeachingGroup, form: FormData) {
    const kind = field(form, "kind");
    const title = field(form, "title");
    const startsAt = parseAcademicLocalTime(field(form, "startsAt"));
    if (kind !== "SESSIONAL" && kind !== "ASSIGNMENT" && kind !== "QUIZ") throw new Error("Choose an event type.");
    if (!title || title.length > 120 || !startsAt) throw new Error("Enter a title and valid date.");
    const event = await this.db.calendarEvent.create({ data: {
      title, kind, startsAt, createdByAuthId: this.teacher.authUserId,
      ...group,
    } });
    const enrolments = await this.db.enrolment.findMany({ where: group, select: { studentId: true } });
    await this.db.notification.createMany({ data: enrolments.map(({ studentId }) => ({
      studentId, eventId: event.id, type: "CALENDAR", message: `${title} · ${formatAcademicTime(startsAt)}`,
      dedupeKey: `event:${event.id}:${studentId}`,
    })), skipDuplicates: true });
  }

  async updateSubjectEvent(group: TeachingGroup, form: FormData) {
    const eventId = field(form, "eventId");
    const event = await this.db.calendarEvent.findUnique({ where: { id: eventId } });
    if (!event || event.createdByAuthId !== this.teacher.authUserId || event.subjectId !== group.subjectId || event.termId !== group.termId || event.section !== group.section) {
      throw new Error("This calendar item cannot be edited.");
    }
    const title = field(form, "title");
    const startsAt = parseAcademicLocalTime(field(form, "startsAt"));
    if (!title || title.length > 120 || !startsAt) throw new Error("Enter a title and valid date.");
    await this.db.$transaction([
      this.db.calendarEvent.update({ where: { id: eventId }, data: { title, startsAt } }),
      this.db.notification.updateMany({ where: { eventId }, data: { message: `${title} · ${formatAcademicTime(startsAt)}` } }),
    ]);
  }

  async replyToStudent(threadId: string, message: string, close: boolean) {
    const thread = await this.db.questionThread.findUnique({ where: { id: threadId }, include: { student: true } });
    if (!thread || thread.teacherId !== this.teacher.teacherId) throw new Error("This question is outside your classes.");
    const [groups, enrolments] = await Promise.all([
      this.db.teachingAssignment.findMany({ where: { teacherId: this.teacher.teacherId, subjectId: thread.subjectId } }),
      this.db.enrolment.findMany({ where: { studentId: thread.studentId, subjectId: thread.subjectId } }),
    ]);
    if (!groups.some((group) => enrolments.some((row) => row.termId === group.termId && row.section === group.section))) {
      throw new Error("This question is outside your classes.");
    }
    if (!message || message.length > 2000) throw new Error("Enter a reply up to 2000 characters.");
    await this.db.$transaction([
      this.db.questionMessage.create({ data: { threadId, authorAuthId: this.teacher.authUserId, body: message } }),
      this.db.questionThread.update({ where: { id: threadId }, data: { status: close ? "CLOSED" : "REPLIED" } }),
    ]);
  }
}
