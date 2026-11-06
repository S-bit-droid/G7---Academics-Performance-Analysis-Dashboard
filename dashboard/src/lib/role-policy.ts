export function compatibleRoleRecords(records: {
  student: boolean;
  admin: boolean;
  teacherDepartmentId: string | null;
  hodDepartmentId: string | null;
}) {
  const { student, admin, teacherDepartmentId, hodDepartmentId } = records;
  const count = Number(student) + Number(admin) + Number(Boolean(teacherDepartmentId)) + Number(Boolean(hodDepartmentId));
  if (count <= 1) return true;
  return count === 2 && teacherDepartmentId !== null && teacherDepartmentId === hodDepartmentId;
}
