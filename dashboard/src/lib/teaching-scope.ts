export function hodCanAssignTeacher(input: {
  hodDepartmentId: string;
  teacherDepartmentId: string;
  subjectDepartmentId: string;
  subjectProgrammeId: string;
  termProgrammeId: string;
}): boolean {
  return input.hodDepartmentId === input.teacherDepartmentId
    && input.hodDepartmentId === input.subjectDepartmentId
    && input.subjectProgrammeId === input.termProgrammeId;
}
