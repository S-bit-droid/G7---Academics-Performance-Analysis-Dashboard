import assert from "node:assert/strict";
import test from "node:test";
import { hodCanAssignTeacher } from "../src/lib/teaching-scope";

const sameDepartment = {
  hodDepartmentId: "d1", teacherDepartmentId: "d1", subjectDepartmentId: "d1",
  subjectProgrammeId: "p1", termProgrammeId: "p1",
};

test("HOD can assign a Teacher only within the same department and programme term", () => {
  assert.equal(hodCanAssignTeacher(sameDepartment), true);
  assert.equal(hodCanAssignTeacher({ ...sameDepartment, teacherDepartmentId: "d2" }), false);
  assert.equal(hodCanAssignTeacher({ ...sameDepartment, subjectDepartmentId: "d2" }), false);
  assert.equal(hodCanAssignTeacher({ ...sameDepartment, termProgrammeId: "p2" }), false);
});
