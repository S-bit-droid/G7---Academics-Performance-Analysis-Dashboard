import "server-only";

import { getDb } from "@/lib/db";

export class AdminScopeService {
  constructor(private readonly db = getDb()) {}

  async appointHod(departmentId: string, teacherId: string): Promise<"unchanged" | "replaced" | "appointed"> {
    if (!departmentId || !teacherId) throw new Error("Choose a Teacher in this department.");
    return this.db.$transaction(async (tx) => {
      const [department, teacher] = await Promise.all([
        tx.department.findUnique({ where: { id: departmentId }, select: { id: true } }),
        tx.teacher.findUnique({ where: { id: teacherId }, select: { authUserId: true, name: true, departmentId: true } }),
      ]);
      if (!department || !teacher || teacher.departmentId !== department.id) {
        throw new Error("Choose a Teacher in this department.");
      }
      const otherAppointment = await tx.hOD.findUnique({ where: { authUserId: teacher.authUserId }, select: { departmentId: true } });
      if (otherAppointment && otherAppointment.departmentId !== departmentId) {
        throw new Error("This Teacher already leads another department.");
      }
      const current = await tx.hOD.findUnique({ where: { departmentId }, select: { authUserId: true } });
      if (current?.authUserId === teacher.authUserId) return "unchanged";
      if (current) await tx.hOD.delete({ where: { departmentId } });
      await tx.hOD.create({ data: { authUserId: teacher.authUserId, name: teacher.name, departmentId } });
      return current ? "replaced" : "appointed";
    }, { isolationLevel: "Serializable" });
  }

  async enrolStudent(input: { studentId: string; subjectId: string; termId: string; section: string }) {
    const { studentId, subjectId, termId, section } = input;
    if (!/^[A-Z0-9-]{1,20}$/.test(section)) throw new Error("Enter a section using up to 20 letters, numbers or hyphens.");
    const [student, subject, term] = await Promise.all([
      this.db.student.findUnique({ where: { id: studentId } }),
      this.db.subject.findUnique({ where: { id: subjectId } }),
      this.db.term.findUnique({ where: { id: termId } }),
    ]);
    if (!student || !subject || !term) throw new Error("Select an existing Student, subject and term.");
    if (student.programmeId !== subject.programmeId || subject.programmeId !== term.programmeId) {
      throw new Error("The Student, subject and term must belong to the same programme.");
    }
    await this.db.enrolment.upsert({
      where: { studentId_subjectId_termId: { studentId, subjectId, termId } },
      create: { studentId, subjectId, termId, section }, update: { section },
    });
  }
}
