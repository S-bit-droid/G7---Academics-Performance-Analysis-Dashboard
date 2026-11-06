const OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function parseAcademicLocalTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}+05:30`);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 16) === value ? date : null;
}

export function academicTimeInput(date: Date) {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

export function parseAcademicDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function formatAcademicTime(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  }).format(date);
}
