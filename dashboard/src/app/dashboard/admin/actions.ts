"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { roleForAuthUser } from "@/lib/access";
import { getDb } from "@/lib/db";
import { AccountInput, AccountRole, isAccountRole, MAX_CSV_BYTES, parseAccountCsv, validateAccountRows } from "@/lib/admin-accounts";
import { createAdminClient, inviteRedirectUrl, listAuthUsers } from "@/lib/supabase/admin";
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

async function checkAccounts(role: AccountRole, rows: AccountInput[]): Promise<string[]> {
  const db = getDb();
  const issues = validateAccountRows(role, rows);
  if (issues.length) return issues;
  const existingEmails = new Set((await listAuthUsers()).map((user) => user.email));
  for (const row of rows) if (existingEmails.has(row.email)) issues.push(`Line ${row.line}: this email already has an account.`);
  if (role === "STUDENT") {
    const [programmes, students] = await Promise.all([
      db.programme.findMany({ where: { code: { in: rows.map((row) => row.programmeCode!) } }, select: { code: true } }),
      db.student.findMany({ where: { OR: [
        { facultyNo: { in: rows.map((row) => row.facultyNo!) } },
        { enrolmentNo: { in: rows.map((row) => row.enrolmentNo!) } },
      ] }, select: { facultyNo: true, enrolmentNo: true } }),
    ]);
    const codes = new Set(programmes.map((item) => item.code));
    const facultyNumbers = new Set(students.map((item) => item.facultyNo));
    const enrolmentNumbers = new Set(students.map((item) => item.enrolmentNo));
    for (const row of rows) {
      if (!codes.has(row.programmeCode!)) issues.push(`Line ${row.line}: programme_code was not found.`);
      if (facultyNumbers.has(row.facultyNo!)) issues.push(`Line ${row.line}: faculty_no already exists.`);
      if (enrolmentNumbers.has(row.enrolmentNo!)) issues.push(`Line ${row.line}: enrolment_no already exists.`);
    }
  }
  if (role === "TEACHER") {
    const departments = await db.department.findMany({ where: { code: { in: rows.map((row) => row.departmentCode!) } } });
    const byCode = new Map(departments.map((item) => [item.code, item]));
    for (const row of rows) {
      const department = byCode.get(row.departmentCode!);
      if (!department) issues.push(`Line ${row.line}: department_code was not found.`);
    }
  }
  return issues;
}

async function createRoleRecord(role: AccountRole, row: AccountInput, authUserId: string) {
  const db = getDb();
  if (role === "STUDENT") {
    const programme = await db.programme.findUniqueOrThrow({ where: { code: row.programmeCode! } });
    await db.student.create({ data: {
      authUserId, name: row.name, facultyNo: row.facultyNo!, enrolmentNo: row.enrolmentNo!, programmeId: programme.id,
    } });
  } else if (role === "TEACHER") {
    const department = await db.department.findUniqueOrThrow({ where: { code: row.departmentCode! } });
    await db.teacher.create({ data: { authUserId, name: row.name, departmentId: department.id } });
  } else {
    await db.admin.create({ data: { authUserId, name: row.name } });
  }
}

async function provision(role: AccountRole, rows: AccountInput[]): Promise<ProvisionState> {
  try {
    if (process.env.AUTH_INVITE_TEMPLATE_READY !== "true") {
      return errorState("Configure the Supabase invite email template and set AUTH_INVITE_TEMPLATE_READY=true before sending invitations.");
    }
    const issues = await checkAccounts(role, rows);
    if (issues.length) return errorState(`${issues.slice(0, 8).join(" ")}${issues.length > 8 ? ` And ${issues.length - 8} more issue(s).` : ""} No accounts were created.`);
    const redirectTo = inviteRedirectUrl();
    const client = createAdminClient();
    const results: ProvisionState["results"] = [];
    for (const row of rows) {
      const { data, error } = await client.auth.admin.inviteUserByEmail(row.email, {
        data: { name: row.name }, redirectTo,
      });
      if (error || !data.user) {
        results.push({ line: row.line, email: row.email, outcome: `Invitation failed: ${error?.message ?? "no user returned"}` });
        continue;
      }
      try {
        await createRoleRecord(role, row, data.user.id);
        results.push({ line: row.line, email: row.email, outcome: "Account created and invitation sent" });
      } catch {
        const { error: cleanupError } = await client.auth.admin.deleteUser(data.user.id);
        results.push({ line: row.line, email: row.email, outcome: cleanupError
          ? "Role setup failed; Auth cleanup also failed. Check this account in Supabase before retrying."
          : "Role setup failed; the new Auth account was removed. Check the role scope before retrying." });
      }
    }
    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard");
    const success = results.filter((row) => row.outcome === "Account created and invitation sent").length;
    return { message: `${success} of ${rows.length} account(s) created and invited. Failed rows can be corrected and retried.`, results };
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
  if (!departmentId || !teacherId) return { ok: false, message: "Choose a Teacher in this department." };
  const db = getDb();
  try {
    const changed = await db.$transaction(async (tx) => {
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
  if (!/^[A-Z0-9-]{1,20}$/.test(section)) return errorState("Enter a section using up to 20 letters, numbers or hyphens.");
  const db = getDb();
  const [student, subject, term] = await Promise.all([
    db.student.findUnique({ where: { id: studentId } }),
    db.subject.findUnique({ where: { id: subjectId } }),
    db.term.findUnique({ where: { id: termId } }),
  ]);
  if (!student || !subject || !term) return errorState("Select an existing Student, subject and term.");
  if (student.programmeId !== subject.programmeId || subject.programmeId !== term.programmeId) {
    return errorState("The Student, subject and term must belong to the same programme.");
  }
  await db.enrolment.upsert({
    where: { studentId_subjectId_termId: { studentId, subjectId, termId } },
    create: { studentId, subjectId, termId, section }, update: { section },
  });
  revalidatePath("/dashboard/admin");
  return { message: "Student enrolled in the selected teaching group.", results: [] };
}
