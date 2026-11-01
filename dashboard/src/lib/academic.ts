export type CombinedRule = "SUM" | "AVERAGE";
export type AttendanceValue = "PRESENT" | "ABSENT" | "EXCUSED" | "UNRECORDED";

export function combinedSessional(
  first: number | null,
  second: number | null,
  rule: CombinedRule,
): number | null {
  if (first === null || second === null) return null;
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return rule === "SUM" ? first + second : (first + second) / 2;
}

export function marksWarning(
  level: "UG" | "PG",
  first: number | null,
  second: number | null,
  maximum: number,
): boolean {
  if (level !== "PG" || maximum !== 30) return false;
  return [first, second].some((value) => value !== null && value >= 0 && value < 15);
}

export function attendanceSummary(values: AttendanceValue[], current: boolean) {
  // Excused-session counting awaits a confirmed academic rule, so it is excluded.
  const counted = values.filter((value) => value === "PRESENT" || value === "ABSENT").length;
  const attended = values.filter((value) => value === "PRESENT").length;
  const percentage = counted === 0 ? null : (attended / counted) * 100;
  return {
    attended,
    counted,
    percentage,
    warning: current && percentage !== null && percentage < 30,
  };
}
