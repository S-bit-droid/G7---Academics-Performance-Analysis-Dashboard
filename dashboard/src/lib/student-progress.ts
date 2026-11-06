export type AttendanceTrendPoint = { month: string; percentage: number; attended: number; counted: number };

export function monthlyAttendanceTrend(reports: { month: string; summary: unknown }[]): AttendanceTrendPoint[] {
  return reports.flatMap(({ month, summary }) => {
    if (!summary || typeof summary !== "object" || Array.isArray(summary)) return [];
    const subjects = (summary as { subjects?: unknown }).subjects;
    if (!Array.isArray(subjects)) return [];
    let attended = 0;
    let counted = 0;
    for (const item of subjects) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const attendance = (item as { attendance?: unknown }).attendance;
      if (!attendance || typeof attendance !== "object" || Array.isArray(attendance)) continue;
      const row = attendance as { attended?: unknown; counted?: unknown };
      if (typeof row.attended !== "number" || typeof row.counted !== "number" ||
          !Number.isInteger(row.attended) || !Number.isInteger(row.counted) ||
          row.counted <= 0 || row.attended < 0 || row.attended > row.counted) continue;
      attended += row.attended;
      counted += row.counted;
    }
    return counted ? [{ month, attended, counted, percentage: (attended / counted) * 100 }] : [];
  }).sort((a, b) => a.month.localeCompare(b.month));
}
