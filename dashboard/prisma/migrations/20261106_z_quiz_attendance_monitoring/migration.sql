ALTER TABLE "Quiz" ADD COLUMN "attendanceOn" DATE;
ALTER TABLE "Quiz" ADD COLUMN "attendanceSessionNo" INTEGER;
ALTER TABLE "QuizAttempt" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN "sessionNo" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "AttendanceRecord_studentId_subjectId_termId_sessionOn_versi_key";
DROP INDEX "AttendanceRecord_subjectId_termId_sessionOn_idx";
CREATE UNIQUE INDEX "AttendanceRecord_student_subject_term_date_session_version_key" ON "AttendanceRecord"("studentId", "subjectId", "termId", "sessionOn", "sessionNo", "version");
CREATE INDEX "AttendanceRecord_subjectId_termId_sessionOn_sessionNo_idx" ON "AttendanceRecord"("subjectId", "termId", "sessionOn", "sessionNo");

CREATE TABLE "QuizActivityEvent" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "durationSeconds" INTEGER,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuizActivityEvent_attemptId_receivedAt_idx" ON "QuizActivityEvent"("attemptId", "receivedAt");
ALTER TABLE "QuizActivityEvent" ADD CONSTRAINT "QuizActivityEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuizActivityEvent" ENABLE ROW LEVEL SECURITY;
