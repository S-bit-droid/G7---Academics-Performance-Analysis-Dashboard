import "server-only";
import { redirect } from "next/navigation";
import { roleForAuthUser } from "@/lib/access";
import { getDb } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function requireTeacher() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const role = await roleForAuthUser(data.claims.sub);
  if (role?.kind === "TEACHER") return { teacherId: role.id, authUserId: data.claims.sub, name: role.name };
  if (role?.kind === "HOD") {
    const teacher = await getDb().teacher.findUnique({ where: { authUserId: data.claims.sub } });
    if (teacher) return { teacherId: teacher.id, authUserId: data.claims.sub, name: teacher.name };
  }
  redirect("/dashboard");
}

export async function requireTeachingGroup(id: string) {
  const teacher = await requireTeacher();
  const group = await getDb().teachingAssignment.findFirst({
    where: { id, teacherId: teacher.teacherId },
    include: { subject: { include: { programme: true } }, term: true },
  });
  if (!group) redirect("/dashboard/teacher");
  return { teacher, group };
}

export async function requireStudentInGroup(assignmentId: string, studentId: string) {
  const { teacher, group } = await requireTeachingGroup(assignmentId);
  const enrolment = await getDb().enrolment.findFirst({
    where: { studentId, subjectId: group.subjectId, termId: group.termId, section: group.section },
    include: { student: { include: { programme: true } } },
  });
  if (!enrolment) redirect(`/dashboard/teacher/${assignmentId}`);
  return { teacher, group, student: enrolment.student };
}
