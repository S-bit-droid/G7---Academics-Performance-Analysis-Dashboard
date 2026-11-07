import "server-only";

import { getDb } from "@/lib/db";
import { storePrivateFile } from "@/lib/private-files";

const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export class StudentWorkspaceService {
  constructor(
    private readonly student: { id: string; authUserId: string; programmeLevel: string },
    private readonly db = getDb(),
  ) {}

  async saveAcademicProfile(form: FormData) {
    const highSchool = field(form, "highSchool");
    const intermediate = field(form, "intermediate");
    const bachelors = field(form, "bachelors");
    const branch = field(form, "branch");
    const interests = field(form, "interests").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
    if (!highSchool || !intermediate || !branch || (this.student.programmeLevel === "PG" && !bachelors)) {
      throw new Error("Complete the required academic background fields.");
    }
    if ([highSchool, intermediate, bachelors, branch].some((item) => item.length > 160) || interests.some((item) => item.length > 80)) {
      throw new Error("Profile fields are too long.");
    }
    await this.db.student.update({ where: { id: this.student.id }, data: {
      highSchool: highSchool || null, intermediate: intermediate || null,
      bachelors: this.student.programmeLevel === "PG" ? bachelors || null : null,
      branch: branch || null, interests,
    } });
  }

  async addWork(form: FormData) {
    const kind = field(form, "kind");
    const title = field(form, "title");
    const description = field(form, "description");
    const link = field(form, "url");
    const file = form.get("file");
    if (!["RESUME", "CERTIFICATION", "SCHOLARSHIP", "PROJECT", "OTHER"].includes(kind)) throw new Error("Choose an item type.");
    if (!title || title.length > 120 || description.length > 1000) throw new Error("Check the title and description lengths.");
    if (link && (!/^https:\/\//i.test(link) || link.length > 500)) throw new Error("Links must use HTTPS and be under 500 characters.");
    if (kind === "RESUME" && (!(file instanceof File) || !file.size)) throw new Error("Choose a resume file.");
    const storagePath = file instanceof File && file.size ? await storePrivateFile(file, `student-work/${this.student.id}`) : null;
    await this.db.studentWork.create({ data: {
      studentId: this.student.id, kind, title, description: description || null, url: link || null, storagePath,
    } });
  }

  async updateWork(form: FormData) {
    const id = field(form, "workId");
    const title = field(form, "title");
    const description = field(form, "description");
    const link = field(form, "url");
    if (!title || title.length > 120 || description.length > 1000) throw new Error("Check the title and description lengths.");
    if (link && (!/^https:\/\//i.test(link) || link.length > 500)) throw new Error("Links must use HTTPS and be under 500 characters.");
    const updated = await this.db.studentWork.updateMany({
      where: { id, studentId: this.student.id },
      data: { title, description: description || null, url: link || null },
    });
    if (!updated.count) throw new Error("Item not found in your profile.");
  }

  async submitAssignment(form: FormData) {
    const materialId = field(form, "materialId");
    const material = await this.db.teachingMaterial.findUnique({ where: { id: materialId }, include: { assignment: true } });
    if (!material || material.kind !== "ASSIGNMENT") throw new Error("Assignment not found.");
    const enrolment = await this.db.enrolment.findFirst({ where: {
      studentId: this.student.id, subjectId: material.assignment.subjectId,
      termId: material.assignment.termId, section: material.assignment.section,
    } });
    if (!enrolment) throw new Error("This assignment is outside your class.");
    if (material.dueAt && new Date() > material.dueAt) throw new Error("The assignment deadline has passed.");
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose a submission file.");
    const storagePath = await storePrivateFile(file, `submissions/${this.student.id}`);
    await this.db.assignmentSubmission.upsert({
      where: { materialId_studentId: { materialId, studentId: this.student.id } },
      create: { materialId, studentId: this.student.id, storagePath },
      update: { storagePath, submittedAt: new Date() },
    });
  }

  async sendFeedback(form: FormData) {
    const assignmentId = field(form, "assignmentId");
    const title = field(form, "title");
    const body = field(form, "body");
    if (!title || title.length > 120 || !body || body.length > 2000) throw new Error("Enter a short title and message.");
    const group = await this.db.teachingAssignment.findUnique({ where: { id: assignmentId } });
    if (!group) throw new Error("Choose an assigned Teacher.");
    const enrolment = await this.db.enrolment.findFirst({ where: {
      studentId: this.student.id, subjectId: group.subjectId, termId: group.termId, section: group.section,
    } });
    if (!enrolment) throw new Error("That Teacher is not assigned to your class.");
    await this.db.questionThread.create({ data: {
      studentId: this.student.id, teacherId: group.teacherId, subjectId: group.subjectId, title,
      messages: { create: { authorAuthId: this.student.authUserId, body } },
    } });
  }
}
