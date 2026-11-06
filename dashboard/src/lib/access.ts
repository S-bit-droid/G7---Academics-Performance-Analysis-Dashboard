import { getDb } from "@/lib/db";
import { compatibleRoleRecords } from "@/lib/role-policy";

export type DashboardRole =
  | { kind: "STUDENT"; id: string; name: string }
  | { kind: "TEACHER"; id: string; name: string }
  | { kind: "HOD"; id: string; name: string }
  | { kind: "ADMIN"; id: string; name: string };

export async function roleForAuthUser(authUserId: string): Promise<DashboardRole | null> {
  const db = getDb();
  // An HOD also has a Teacher profile; all other role combinations are invalid.
  const [student, teacher, hod, admin] = await Promise.all([
    db.student.findUnique({ where: { authUserId }, select: { id: true, name: true } }),
    db.teacher.findUnique({ where: { authUserId }, select: { id: true, name: true, departmentId: true } }),
    db.hOD.findUnique({ where: { authUserId }, select: { id: true, name: true, departmentId: true } }),
    db.admin.findUnique({ where: { authUserId }, select: { id: true, name: true } }),
  ]);
  if (!compatibleRoleRecords({ student: Boolean(student), admin: Boolean(admin), teacherDepartmentId: teacher?.departmentId ?? null, hodDepartmentId: hod?.departmentId ?? null })) {
    throw new Error("An account has incompatible dashboard roles.");
  }
  if (student) return { kind: "STUDENT", ...student };
  if (hod) return { kind: "HOD", id: hod.id, name: hod.name };
  if (teacher) return { kind: "TEACHER", id: teacher.id, name: teacher.name };
  if (admin) return { kind: "ADMIN", ...admin };
  return null;
}
