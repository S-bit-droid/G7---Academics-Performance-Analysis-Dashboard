"use server";

import { revalidatePath } from "next/cache";
import { requireHod } from "@/lib/hod-access";
import { HodDepartmentService } from "@/lib/role-services/hod-department-service";

export type AssignmentState = { message: string; ok: boolean };

async function currentService() {
  const hod = await requireHod();
  return new HodDepartmentService(hod.departmentId, hod.authUserId);
}

export async function assignTeachingGroup(_previous: AssignmentState, formData: FormData): Promise<AssignmentState> {
  const service = await currentService();
  const result = await service.assignTeachingGroup({
    teacherId: String(formData.get("teacherId") ?? ""),
    subjectId: String(formData.get("subjectId") ?? ""),
    termId: String(formData.get("termId") ?? ""),
    section: String(formData.get("section") ?? "").trim().toUpperCase(),
  });
  if (result.ok) {
    revalidatePath("/dashboard/hod");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function issueTimetable(formData: FormData) {
  const service = await currentService();
  await service.issueTimetable({
    programmeId: String(formData.get("programmeId") ?? ""),
    termId: String(formData.get("termId") ?? ""),
    section: String(formData.get("section") ?? "").trim().toUpperCase(),
    title: String(formData.get("title") ?? "").trim(),
    file: formData.get("file"),
  });
  revalidatePath("/dashboard/hod");
  revalidatePath("/dashboard/student");
  revalidatePath("/dashboard/teacher");
}

export async function saveDepartmentEvent(formData: FormData) {
  const service = await currentService();
  await service.saveEvent({
    eventId: String(formData.get("eventId") ?? ""),
    title: String(formData.get("title") ?? "").trim(),
    kind: String(formData.get("kind") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
  });
  revalidatePath("/dashboard/hod");
  revalidatePath("/dashboard/student");
  revalidatePath("/dashboard/teacher");
}
