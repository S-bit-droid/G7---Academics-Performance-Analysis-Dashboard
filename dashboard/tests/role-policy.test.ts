import assert from "node:assert/strict";
import test from "node:test";
import { compatibleRoleRecords } from "../src/lib/role-policy";

test("HOD and Teacher roles share one Auth identity only within the same department", () => {
  assert.equal(compatibleRoleRecords({ student: false, admin: false, teacherDepartmentId: "d1", hodDepartmentId: "d1" }), true);
  assert.equal(compatibleRoleRecords({ student: false, admin: false, teacherDepartmentId: "d1", hodDepartmentId: "d2" }), false);
  assert.equal(compatibleRoleRecords({ student: false, admin: false, teacherDepartmentId: null, hodDepartmentId: "d1" }), false);
  assert.equal(compatibleRoleRecords({ student: true, admin: false, teacherDepartmentId: "d1", hodDepartmentId: "d1" }), false);
  assert.equal(compatibleRoleRecords({ student: false, admin: true, teacherDepartmentId: "d1", hodDepartmentId: "d1" }), false);
});
