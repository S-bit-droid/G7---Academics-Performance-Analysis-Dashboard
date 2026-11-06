import assert from "node:assert/strict";
import test from "node:test";
import { academicTimeInput, formatAcademicTime, parseAcademicDate, parseAcademicLocalTime } from "../src/lib/academic-time";

test("calendar local time round trips through UTC storage", () => {
  const date = parseAcademicLocalTime("2026-11-06T10:00");
  assert.equal(date?.toISOString(), "2026-11-06T04:30:00.000Z");
  assert.equal(academicTimeInput(date!), "2026-11-06T10:00");
  assert.match(formatAcademicTime(date!), /10:00/);
});

test("calendar rejects impossible local dates", () => {
  assert.equal(parseAcademicLocalTime("2026-02-31T10:00"), null);
  assert.equal(parseAcademicDate("2026-02-31"), null);
  assert.equal(parseAcademicDate("2026-11-06")?.toISOString(), "2026-11-06T00:00:00.000Z");
});
