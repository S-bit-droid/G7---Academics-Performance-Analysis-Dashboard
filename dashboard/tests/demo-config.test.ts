import assert from "node:assert/strict";
import test from "node:test";
import { readDemoConfig } from "../scripts/demo-config";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test",
  SUPABASE_SECRET_KEY: "secret-test",
  DATABASE_URL: "postgresql://demo:password@pooler.example:6543/postgres",
  DIRECT_URL: "postgresql://demo:password@pooler.example:5432/postgres",
  DEMO_ADMIN_EMAIL: "admin@example.org",
  DEMO_ADMIN_PASSWORD: "admin-password-123",
  DEMO_STUDENT_EMAIL: "student@example.org",
  DEMO_STUDENT_PASSWORD: "student-password-123",
  DEMO_TEACHER_EMAIL: "teacher@example.org",
  DEMO_TEACHER_PASSWORD: "teacher-password-123",
  DEMO_HOD_EMAIL: "hod@example.org",
  DEMO_HOD_PASSWORD: "hod-password-123",
};

test("bootstrap config requires four distinct role credentials", () => {
  const config = readDemoConfig(valid);
  assert.equal(config.people.STUDENT.email, "student@example.org");
  assert.equal(config.people.HOD.name, "Demo HOD");
  assert.throws(() => readDemoConfig({ ...valid, DEMO_HOD_EMAIL: valid.DEMO_STUDENT_EMAIL }), /different email/);
  assert.throws(() => readDemoConfig({ ...valid, DEMO_HOD_PASSWORD: valid.DEMO_STUDENT_PASSWORD }), /different password/);
});

test("bootstrap config rejects missing or unsafe credentials before mutation", () => {
  assert.throws(() => readDemoConfig({ ...valid, SUPABASE_SECRET_KEY: "" }), /SUPABASE_SECRET_KEY/);
  assert.throws(() => readDemoConfig({ ...valid, SUPABASE_SECRET_KEY: valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }), /must differ/);
  assert.throws(() => readDemoConfig({ ...valid, DEMO_ADMIN_PASSWORD: "short" }), /at least 12/);
  assert.throws(() => readDemoConfig({ ...valid, DIRECT_URL: "https://not-postgres.example" }), /PostgreSQL/);
});
