import assert from "node:assert/strict";
import test from "node:test";
import { parseAttendanceRows, parseMarksRows } from "../src/lib/imports";

test("marks parser finds agreed columns and flags a total mismatch", () => {
  const result = parseMarksRows([
    ["Serial number", "Name", "Faculty no.", "Enrollment no.", "Sessional 1", "Sessional 2", "Total marks"],
    [1, "Student A", "FA-1", "EN-1", 18, 22, 40],
    [2, "Student B", "FA-2", "EN-2", 15, 16, 40],
  ], 30, "SUM");
  assert.equal(result.accepted.length, 2);
  assert.equal(result.accepted[0].expectedTotal, 40);
  assert.equal(result.discrepancies.length, 1);
  assert.equal(result.discrepancies[0].row, 3);
});

test("marks parser rejects duplicate IDs and marks above maximum", () => {
  const result = parseMarksRows([
    ["Name", "Faculty no.", "Enrollment no.", "Sessional 1", "Sessional 2", "Total"],
    ["A", "F1", "E1", 31, 12, 43],
    ["A", "F1", "E1", 10, 12, 22],
  ], 30, "SUM");
  assert.equal(result.accepted.length, 0);
  assert.equal(result.issues.length, 2);
});

test("attendance parser keeps blank as unrecorded and accepts two dated sessions", () => {
  const result = parseAttendanceRows([
    ["Serial number", "Name", "Faculty number", "Enrolment number", "01/10/2026", "2026-10-02"],
    [1, "Student A", "F1", "E1", "P", ""],
    [2, "Student B", "F2", "E2", "Absent", "Present"],
  ]);
  assert.equal(result.issues.length, 0);
  assert.equal(result.accepted.length, 4);
  assert.equal(result.accepted[0].sessionOn, "2026-10-01");
  assert.equal(result.accepted[1].status, "UNRECORDED");
});

test("attendance parser rejects an unknown code and impossible date", () => {
  const result = parseAttendanceRows([
    ["Name", "Faculty no.", "Enrollment no.", "2026-02-31", "2026-03-01"],
    ["Student A", "F1", "E1", "P", "late"],
  ]);
  assert.equal(result.accepted.length, 0);
  assert.ok(result.issues.some((item) => item.message.includes("Unrecognised")));
});
