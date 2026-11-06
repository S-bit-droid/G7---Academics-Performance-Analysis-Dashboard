import assert from "node:assert/strict";
import test from "node:test";
import { attendanceAttemptLabel, latestAttendanceByStudent } from "../src/lib/quiz-review";

test("quiz attendance comparison identifies gaps without assuming misconduct", () => {
  assert.equal(attendanceAttemptLabel("PRESENT", true), "Present and attempted");
  assert.equal(attendanceAttemptLabel("PRESENT", false), "Present, no attempt");
  assert.match(attendanceAttemptLabel("ABSENT", true), /review/);
  assert.equal(attendanceAttemptLabel(null, true), "Attendance not confirmed");
});

test("quiz comparison uses the latest released attendance version", () => {
  const rows = [
    { studentId: "s1", status: "ABSENT" as const, releasedAt: new Date("2026-11-06T08:00:00Z") },
    { studentId: "s1", status: "PRESENT" as const, releasedAt: new Date("2026-11-06T09:00:00Z") },
  ];
  assert.equal(latestAttendanceByStudent(rows).get("s1")?.status, "PRESENT");
});
