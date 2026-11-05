"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { roleForAuthUser } from "@/lib/access";
import { getDb } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { hodCanAssignTeacher } from "@/lib/teaching-scope";

export type AssignmentState = { message: string; ok: boolean };

export async function assignTeachingGroup(_previous: AssignmentState, formData: FormData): Promise<AssignmentState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const role = await roleForAuthUser(data.claims.sub);
  if (role?.kind !== "HOD") redirect("/dashboard");

  const teacherId = String(formData.get("teacherId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const termId = String(formData.get("termId") ?? "");
  const section = String(formData.get("section") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,20}$/.test(section)) return { ok: false, message: "Enter a section using up to 20 letters, numbers or hyphens." };

  const db = getDb();
  const [hod, teacher, subject, term] = await Promise.all([
    db.hOD.findUnique({ where: { id: role.id } }),
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
