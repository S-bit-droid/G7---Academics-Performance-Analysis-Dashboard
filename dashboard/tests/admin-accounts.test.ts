import assert from "node:assert/strict";
import test from "node:test";
import { accountRoles, isAccountRole, parseAccountCsv } from "../src/lib/admin-accounts";

test("HOD is an appointment, not a role created through account import", () => {
  assert.deepEqual(accountRoles, ["STUDENT", "TEACHER", "ADMIN"]);
  assert.equal(isAccountRole("HOD"), false);
});

test("student CSV accepts a BOM, reordered columns and a quoted name", () => {
  const parsed = parseAccountCsv("\uFEFFemail,name,programme_code,enrolment_no,faculty_no\r\nstudent@example.org,\"Khan, A\",BCA,EN-01,F-01\r\n", "STUDENT");
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.rows[0].name, "Khan, A");
  assert.equal(parsed.rows[0].programmeCode, "BCA");
  assert.equal(parsed.rows[0].line, 2);
});

test("role-specific CSV rejects duplicate emails and missing scope", () => {
  const parsed = parseAccountCsv("name,email,department_code\nTeacher A,a@example.org,CS\nTeacher B,A@example.org,\n", "TEACHER");
  assert.match(parsed.issues.join(" "), /email is repeated/);
  assert.match(parsed.issues.join(" "), /department_code is required/);
});

test("a CSV for the wrong role is rejected before accounts are created", () => {
  const parsed = parseAccountCsv("name,email,faculty_no,enrolment_no,programme_code\nA,a@example.org,F1,E1,P1", "ADMIN");
  assert.equal(parsed.rows.length, 0);
  assert.match(parsed.issues.join(" "), /Unexpected column/);
});

test("CSV parser rejects malformed quoted input", () => {
  const parsed = parseAccountCsv('name,email\n"Unclosed,a@example.org', "ADMIN");
  assert.match(parsed.issues.join(" "), /ends inside a quoted field/);
});
