ALTER TYPE "AttendanceKind" ADD VALUE 'CSV';

ALTER TABLE "Quiz" ADD COLUMN "section" TEXT;
ALTER TABLE "Quiz" ADD COLUMN "availableUntil" TIMESTAMP(3);
ALTER TABLE "QuizAttempt" ADD COLUMN "timedOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Student" ADD COLUMN "branch" TEXT;
ALTER TABLE "CalendarEvent" ADD COLUMN "section" TEXT;
DROP INDEX IF EXISTS "QuizAttempt_quizId_studentId_idx";
CREATE UNIQUE INDEX "QuizAttempt_quizId_studentId_key" ON "QuizAttempt"("quizId", "studentId");

CREATE TABLE "TeachingMaterial" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "storagePath" TEXT,
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeachingMaterial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentSubmission" (
  "id" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyReport" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "summary" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeachingMaterial_assignmentId_createdAt_idx" ON "TeachingMaterial"("assignmentId", "createdAt");
CREATE UNIQUE INDEX "AssignmentSubmission_materialId_studentId_key" ON "AssignmentSubmission"("materialId", "studentId");
CREATE UNIQUE INDEX "MonthlyReport_studentId_month_key" ON "MonthlyReport"("studentId", "month");

ALTER TABLE "TeachingMaterial" ADD CONSTRAINT "TeachingMaterial_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "TeachingMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeachingMaterial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssignmentSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MonthlyReport" ENABLE ROW LEVEL SECURITY;
