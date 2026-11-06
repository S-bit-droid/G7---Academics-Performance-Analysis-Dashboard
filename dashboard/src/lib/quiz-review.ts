export type QuizAttendance = "PRESENT" | "ABSENT" | "EXCUSED" | "UNRECORDED" | null;

export function attendanceAttemptLabel(attendance: QuizAttendance, attempted: boolean) {
  if (attendance === "PRESENT") return attempted ? "Present and attempted" : "Present, no attempt";
  if (attendance === "ABSENT") return attempted ? "Absent but attempted — review" : "Absent, no attempt";
  return "Attendance not confirmed";
}

export function latestAttendanceByStudent<T extends { studentId: string; status: QuizAttendance; releasedAt: Date | null }>(rows: T[]) {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const current = latest.get(row.studentId);
    if (!current || (row.releasedAt?.getTime() ?? 0) > (current.releasedAt?.getTime() ?? 0)) {
      latest.set(row.studentId, row);
    }
  }
  return latest;
}
