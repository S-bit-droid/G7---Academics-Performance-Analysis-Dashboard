-- Existing HOD accounts also need a Teacher profile for personally assigned classes.
ALTER TYPE "EventKind" ADD VALUE IF NOT EXISTS 'SEMINAR';
INSERT INTO "Teacher" ("id", "authUserId", "name", "departmentId")
SELECT h."id", h."authUserId", h."name", h."departmentId"
FROM "HOD" h
WHERE NOT EXISTS (SELECT 1 FROM "Teacher" t WHERE t."authUserId" = h."authUserId");

CREATE TABLE "Timetable" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "issuedByAuthId" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Timetable_programmeId_termId_section_issuedAt_idx" ON "Timetable"("programmeId", "termId", "section", "issuedAt");
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Timetable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Timetable" FROM anon, authenticated;
