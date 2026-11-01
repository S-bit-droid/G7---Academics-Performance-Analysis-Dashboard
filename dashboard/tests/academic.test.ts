import assert from "node:assert/strict";
import test from "node:test";
import { attendanceSummary, combinedSessional, marksWarning } from "../src/lib/academic";

test("Teacher-selected combined rule is the only computed result", () => {
  assert.equal(combinedSessional(18, 24, "SUM"), 42);
  assert.equal(combinedSessional(18, 24, "AVERAGE"), 21);
  assert.equal(combinedSessional(null, 24, "SUM"), null);
});

test("marks warning applies only to PG sessionals below 15 out of 30", () => {
  assert.equal(marksWarning("UG", 10, 10, 30), false);
  assert.equal(marksWarning("PG", 14, 20, 30), true);
  assert.equal(marksWarning("PG", 15, 20, 30), false);
  assert.equal(marksWarning("PG", null, 20, 30), false);
  assert.equal(marksWarning("PG", 10, 20, 40), false);
});

test("attendance excludes unconfirmed excused sessions and suppresses stale warnings", () => {
  assert.deepEqual(attendanceSummary([], true), {
    attended: 0, counted: 0, percentage: null, warning: false,
  });
  assert.deepEqual(attendanceSummary(["PRESENT", "ABSENT", "ABSENT", "ABSENT", "EXCUSED"], true), {
    attended: 1, counted: 4, percentage: 25, warning: true,
  });
  assert.equal(attendanceSummary(["PRESENT", "ABSENT", "ABSENT", "ABSENT"], false).warning, false);
  assert.equal(attendanceSummary(["PRESENT", "UNRECORDED"], true).counted, 1);
});
