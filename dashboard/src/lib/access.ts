import { getDb } from "@/lib/db";

export type DashboardRole =
  | { kind: "STUDENT"; id: string; name: string }
  | { kind: "TEACHER"; id: string; name: string }
  | { kind: "HOD"; id: string; name: string }
  | { kind: "ADMIN"; id: string; name: string };

export async function roleForAuthUser(authUserId: string): Promise<DashboardRole | null> {
  const db = getDb();
  // Provisioned accounts are mapped to exactly one of the four separate role tables.
  const [student, teacher, hod, admin] = await Promise.all([
    db.student.findUnique({ where: { authUserId }, select: { id: true, name: true } }),
    db.teacher.findUnique({ where: { authUserId }, select: { id: true, name: true } }),
    db.hOD.findUnique({ where: { authUserId }, select: { id: true, name: true } }),
    db.admin.findUnique({ where: { authUserId }, select: { id: true, name: true } }),
  ]);
  const found = [student, teacher, hod, admin].filter(Boolean).length;
  if (found > 1) throw new Error("An account has more than one dashboard role.");
  if (student) return { kind: "STUDENT", ...student };
  if (teacher) return { kind: "TEACHER", ...teacher };
  if (hod) return { kind: "HOD", ...hod };
  if (admin) return { kind: "ADMIN", ...admin };
  return null;
}
