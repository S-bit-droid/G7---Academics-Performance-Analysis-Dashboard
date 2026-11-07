"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { roleForAuthUser } from "@/lib/access";
import { AccountInput, AccountRole, isAccountRole, MAX_CSV_BYTES, parseAccountCsv } from "@/lib/admin-accounts";
import { AdminAccountService } from "@/lib/role-services/admin-account-service";
import { AdminScopeService } from "@/lib/role-services/admin-scope-service";
import { createClient } from "@/lib/supabase/server";
import type { HodAppointmentState, ProvisionState } from "./form-state";

async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const role = await roleForAuthUser(data.claims.sub);
  if (role?.kind !== "ADMIN") redirect("/dashboard");
}

function errorState(message: string): ProvisionState { return { message, results: [] }; }

async function provision(role: AccountRole, rows: AccountInput[]): Promise<ProvisionState> {
  try {
    const { issues, results } = await new AdminAccountService().create(role, rows);
    if (issues.length) return errorState(`${issues.slice(0, 8).join(" ")}${issues.length > 8 ? ` And ${issues.length - 8} more issue(s).` : ""} No accounts were created.`);
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard");
    const success = results.filter((row) => row.outcome === "Account created").length;
    return { message: `${success} of ${rows.length} account(s) created. Copy initial passwords now; they will not be shown again. No emails were sent.`, results };
  } catch (error) {
    return errorState(error instanceof Error ? error.message : "Account creation failed.");
  }
}

export async function createManualAccount(_previous: ProvisionState, formData: FormData): Promise<ProvisionState> {
  await requireAdmin();
  const roleValue = String(formData.get("role") ?? "");
  if (!isAccountRole(roleValue)) return errorState("Choose a valid role.");
  const row: AccountInput = {
    line: 1,
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    facultyNo: String(formData.get("facultyNo") ?? "").trim(),
    enrolmentNo: String(formData.get("enrolmentNo") ?? "").trim(),
    programmeCode: String(formData.get("programmeCode") ?? "").trim(),
    departmentCode: String(formData.get("departmentCode") ?? "").trim(),
  };
  return provision(roleValue, [row]);
}

export async function createCsvAccounts(_previous: ProvisionState, formData: FormData): Promise<ProvisionState> {
  await requireAdmin();
  const roleValue = String(formData.get("role") ?? "");
  if (!isAccountRole(roleValue)) return errorState("Choose a valid role.");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) return errorState("Choose a .csv file.");
  if (file.size < 1 || file.size > MAX_CSV_BYTES) return errorState("CSV must be between 1 byte and 64 KB.");
  const parsed = parseAccountCsv(await file.text(), roleValue);
  if (parsed.issues.length) return errorState(`${parsed.issues.slice(0, 8).join(" ")} No accounts were created.`);
  return provision(roleValue, parsed.rows);
}

export async function appointHod(_previous: HodAppointmentState, formData: FormData): Promise<HodAppointmentState> {
  await requireAdmin();
  const departmentId = String(formData.get("departmentId") ?? "");
  const teacherId = String(formData.get("teacherId") ?? "");
  try {
    const changed = await new AdminScopeService().appointHod(departmentId, teacherId);
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/hod");
    revalidatePath("/dashboard/teacher");
    return { ok: true, message: changed === "replaced" ? "HOD appointment updated. The previous HOD now has Teacher access only." : changed === "appointed" ? "Teacher appointed as HOD." : "This Teacher is already the HOD." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { ok: false, message: ["Choose a Teacher in this department.", "This Teacher already leads another department."].includes(message)
      ? message : "The appointment could not be saved. Refresh and try again." };
  }
}

export async function enrolStudentInSubject(_previous: ProvisionState, formData: FormData): Promise<ProvisionState> {
  await requireAdmin();
  const studentId = String(formData.get("studentId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const termId = String(formData.get("termId") ?? "");
  const section = String(formData.get("section") ?? "").trim().toUpperCase();
  try { await new AdminScopeService().enrolStudent({ studentId, subjectId, termId, section }); }
  catch (error) { return errorState(error instanceof Error ? error.message : "Student could not be enrolled."); }
  revalidatePath("/dashboard/admin");
  return { message: "Student enrolled in the selected teaching group.", results: [] };
}
