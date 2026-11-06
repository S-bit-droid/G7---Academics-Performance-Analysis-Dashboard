import assert from "node:assert/strict";
import test from "node:test";
import { monthlyAttendanceTrend } from "../src/lib/student-progress";

test("monthly trend weights attendance by counted sessions and skips missing data", () => {
  assert.deepEqual(monthlyAttendanceTrend([
    { month: "2026-10", summary: { subjects: [{ attendance: { attended: 1, counted: 2 } }, { attendance: { attended: 8, counted: 8 } }] } },
    { month: "2026-09", summary: { subjects: [{ attendance: { attended: 0, counted: 0 } }] } },
    { month: "2026-11", summary: { subjects: [{ attendance: { attended: 5, counted: 10 } }] } },
  ]), [
    { month: "2026-10", attended: 9, counted: 10, percentage: 90 },
    { month: "2026-11", attended: 5, counted: 10, percentage: 50 },
  ]);
});
