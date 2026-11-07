import "server-only";

import { randomBytes } from "node:crypto";
import type { AccountInput, AccountRole } from "@/lib/admin-accounts";
import { validateAccountRows } from "@/lib/admin-accounts";
import { getDb } from "@/lib/db";
import { createAdminClient, listAuthUsers } from "@/lib/supabase/admin";

export type AccountCreationResult = {
  line: number;
  email: string;
  outcome: string;
  initialPassword?: string;
};

export class AdminAccountService {
  constructor(
    private readonly db = getDb(),
    private readonly auth = createAdminClient(),
  ) {}

  async validate(role: AccountRole, rows: AccountInput[]): Promise<string[]> {
    const issues = validateAccountRows(role, rows);
    if (issues.length) return issues;
    const existingEmails = new Set((await listAuthUsers()).map((user) => user.email));
    for (const row of rows) if (existingEmails.has(row.email)) issues.push(`Line ${row.line}: this email already has an account.`);
    if (role === "STUDENT") {
      const [programmes, students] = await Promise.all([
        this.db.programme.findMany({ where: { code: { in: rows.map((row) => row.programmeCode!) } }, select: { code: true } }),
        this.db.student.findMany({ where: { OR: [
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
      const departments = await this.db.department.findMany({ where: { code: { in: rows.map((row) => row.departmentCode!) } } });
      const byCode = new Map(departments.map((item) => [item.code, item]));
      for (const row of rows) if (!byCode.has(row.departmentCode!)) issues.push(`Line ${row.line}: department_code was not found.`);
    }
    return issues;
  }

  private async createRoleRecord(role: AccountRole, row: AccountInput, authUserId: string) {
    if (role === "STUDENT") {
      const programme = await this.db.programme.findUniqueOrThrow({ where: { code: row.programmeCode! } });
      await this.db.student.create({ data: {
        authUserId, name: row.name, facultyNo: row.facultyNo!, enrolmentNo: row.enrolmentNo!, programmeId: programme.id,
      } });
    } else if (role === "TEACHER") {
      const department = await this.db.department.findUniqueOrThrow({ where: { code: row.departmentCode! } });
      await this.db.teacher.create({ data: { authUserId, name: row.name, departmentId: department.id } });
    } else {
      await this.db.admin.create({ data: { authUserId, name: row.name } });
    }
  }

  async create(role: AccountRole, rows: AccountInput[]): Promise<{ issues: string[]; results: AccountCreationResult[] }> {
    const issues = await this.validate(role, rows);
    if (issues.length) return { issues, results: [] };
    const results: AccountCreationResult[] = [];
    for (const row of rows) {
      const initialPassword = randomBytes(24).toString("base64url");
      const { data, error } = await this.auth.auth.admin.createUser({
        email: row.email, password: initialPassword, email_confirm: true,
        user_metadata: { name: row.name },
      });
      if (error || !data.user) {
        results.push({ line: row.line, email: row.email, outcome: `Account creation failed: ${error?.message ?? "no user returned"}` });
        continue;
      }
      try {
        await this.createRoleRecord(role, row, data.user.id);
        results.push({ line: row.line, email: row.email, outcome: "Account created", initialPassword });
      } catch {
        const { error: cleanupError } = await this.auth.auth.admin.deleteUser(data.user.id);
        results.push({ line: row.line, email: row.email, outcome: cleanupError
          ? "Role setup failed; Auth cleanup also failed. Check this account in Supabase before retrying."
          : "Role setup failed; the new Auth account was removed. Check the role scope before retrying." });
      }
    }
    return { issues: [], results };
  }
}
