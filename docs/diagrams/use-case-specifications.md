# Dashboard use-case specifications

**Record:** UCSPEC-001 · **Status:** analysis draft for group and faculty review · **Basis:** FEATURE-004 and PS-002/REQ-003. These specifications describe observable behaviour; they do not approve unconfirmed academic or support policies. IDs correspond to the use-case drawings in this directory.

## SC-01 — Receive and validate academic records

**Primary actor:** assigned Teacher. **Supporting system:** authorised Google Sheet, when selected. **Trigger:** a new marks workbook, an attendance workbook, or a selected Sheet refresh. **Preconditions:** the subject, section, term, roster and Teacher assignment exist; one attendance route is active for that teaching group.

1. The Teacher uploads the existing examination-office marks workbook, or uses the selected attendance route: linked Sheet read or dated-column Excel upload.
2. The system identifies the teaching group and maps students by faculty/enrolment number, then checks required columns, duplicates, valid values and the applicable assessment or session dates.
3. For marks, it shows Sessional 1, Sessional 2, the imported total and any mismatch with the Teacher's selected sum/average rule. For attendance, it reconciles each student and date with existing sessions, including after a source switch.
4. The system presents matched, rejected and changed rows with reasons. The Teacher accepts only a valid batch; the system saves it as a versioned draft and records its source, actor and time.

**Alternatives and exceptions:** invalid or unmatched rows remain rejected for correction at source and a new import; a failed Sheet read leaves the last valid attendance version intact and exposes freshness/error state; a blank attendance cell is unrecorded, not absent; a corrected re-upload replaces the intended record version instead of creating duplicates. **Postcondition:** a validated draft exists or the previous valid data remains intact. **Trace:** FR3-03, 05–11, 14; NFR3-02–05, 08. **Open:** institution-wide workbook template, attendance codes, Sheet access and sync schedule.

## SC-02 — Correct and release subject records

**Primary actor:** assigned Teacher. **Trigger:** validated draft is ready, or a released record needs correction. **Preconditions:** the actor has edit authority for this subject and the selected assessment/source is identified.

1. The Teacher reviews the draft, discrepancies, data coverage and provenance.
2. If correction is needed, the Teacher fixes the source workbook or Sheet and imports/syncs a replacement; the system retains both versions and a correction reason.
3. The Teacher requests release. The system checks role and subject scope, validates the current draft again, records the release event and exposes that version to the affected students.

**Alternatives and exceptions:** invalid draft cannot be released; Teacher may read another subject's released marks for an assigned student but cannot edit or release that subject; a new correction does not silently overwrite the prior released version. **Postcondition:** one identifiable released version is visible, or the existing released version stays visible. **Trace:** FR3-02, 06–12; NFR3-01, 03–05, 08. **Open:** institutional release/reopening authority and correction approval.

## SC-03 — View personal performance and guidance

**Primary actor:** Student. **Trigger:** opens overview, subject detail, report or academic guidance. **Preconditions:** the Student is authenticated; only their own released data is queried.

1. The system displays separate Sessional 1/2 marks and the one combined sum/average result selected by that subject's Teacher, labelled with method and maximum.
2. It calculates selected-month and cumulative attendance from counted sessions and displays numerator, denominator, source freshness and coverage; blanks and missing periods appear as no data.
3. It displays comparable trends and subject results. A Master's sessional below 15/30 produces an individual marks warning; no undergraduate marks warning is generated. Valid attendance below 30% produces an individual attendance warning.
4. The Student may download a personal report using the same released values, or request academic guidance based on permitted released marks, attendance and quiz results with an explanation.

**Alternatives and exceptions:** unreleased, missing, stale or incomparable values are labelled rather than treated as zero or used for false warnings; guidance failure leaves the numerical view usable and cannot alter marks; other students' records are never returned. **Postcondition:** a scoped, labelled view or report; no official record change. **Trace:** FR3-13–16, 19, 25; NFR3-01–04, 06–07. **Open:** maximum-mark rules, rounding, comparable scales, freshness window and AI evaluation.

## SC-04 — Review class, student and department performance

**Primary actors:** assigned Teacher and HOD. **Trigger:** opens a class, assigned student's record, subject indicator or department report. **Preconditions:** teaching assignment or department scope is verified.

1. A Teacher selects their subject, section and term and sees released individual results, attendance, class average, assessed count and count below the applicable mark.
2. For a student in that Teacher's group, the Teacher can compare released results across the student's subjects on comparable scales; those other subjects remain read-only.
3. An HOD sees authorised department/course summaries and can generate a department report using the same calculations and visible coverage.

**Alternatives and exceptions:** absent or incompatible maxima are labelled and excluded from direct ranking; undergraduate mark data is descriptive, without a marks warning; small or incomplete cohorts show their sample size; unauthorised students/subjects are denied. **Postcondition:** no academic record changes. **Trace:** FR3-02, 17–19; NFR3-01–04, 07. **Open:** exact HOD individual-record fields and minimum comparison coverage.

## SC-05 — Publish and attempt a timed quiz

**Primary actors:** assigned Teacher and enrolled Student. **Trigger:** Teacher creates/publishes a quiz; Student starts an available attempt. **Preconditions:** Teacher has subject authority; Student belongs to the target group.

1. Teacher sets MCQ questions, question count and timer, previews and publishes the quiz.
2. Student opens the published quiz and starts an attempt. The system records start/deadline and answers.
3. On submission or timeout, the system closes the attempt, scores the recorded answers and shows the permitted result. Teacher can review results.

**Alternatives and exceptions:** unpublished/closed quiz cannot be started; timeout preserves the captured attempt; duplicate submission does not score twice; quiz score remains separate from official sessional marks. **Postcondition:** a scored attempt and result, or no attempt if access was denied. **Trace:** FR3-20–21; NFR3-01, 03, 08. **Open:** allowed attempts, late-entry, answer-release and scoring rules.

## SC-06 — Maintain student profile, work and questions

**Primary actors:** Student and assigned Teacher. **Trigger:** first sign-in, work update or academic question. **Preconditions:** authenticated account and valid assignment.

1. Student enters or updates school/intermediate background, interests and, for a Master's programme, bachelor's background; the system labels these as self-reported.
2. Student uploads/updates academic work with permitted file/link metadata, or sends a question/feedback thread to an assigned Teacher.
3. Teacher may read the assigned student's profile/work and respond to or close the thread; Teacher cannot edit self-reported background or treat a feedback thread as an official marks correction.

**Alternatives and exceptions:** unsafe/oversize files are rejected; invalid assignment blocks access; an official record dispute is directed to the correction process. **Postcondition:** a scoped profile/work version or dated thread, with no official marks change. **Trace:** FR3-02, 04, 22–23; NFR3-01–02, 04, 08. **Open:** file limits, visibility and escalation rules.

## SC-07 — Publish schedule items and notices

**Primary actors:** assigned Teacher and HOD; **recipient:** relevant Student. **Trigger:** a sessional/assignment/quiz schedule item or department event is published or changed. **Preconditions:** creator has subject or department authority.

1. Teacher schedules a subject event/deadline or HOD schedules a department event, with audience and time.
2. The system checks scope, publishes it to the shared calendar and sends an in-app notice to the relevant students.
3. A student sees the calendar item and linked notice; an authorised creator can update/cancel it and the system reconciles linked notices rather than duplicating them.

**Alternatives and exceptions:** an unauthorised audience is rejected; a calendar deadline does not create assignment submission/grading; low-attendance notices arise only from a valid individual warning and are deduplicated across imports. **Postcondition:** one scoped calendar item and corresponding notice state. **Trace:** FR3-24; NFR3-01, 03, 08. **Open:** reminder timing, cancellation and read-state policy.

## SC-08 - Manage account access

**Actors:** Admin, Student, Teacher and HOD. All four are Account Holders for sign-in/logout; Admin alone provisions accounts and reviews access audit. **Trigger:** sign-in/logout, an approved account request, role/status change, or access-audit review. **Preconditions:** a provisioned account for sign-in; Admin authentication for account changes and audit review.

1. An Account Holder signs in. The system verifies credentials and account status before granting the role's permitted access; logout ends the session.
2. Admin provisions an account or changes its role/status within approved access rules. The system checks the details and records the actor, time and change.
3. Admin may review account and access events to investigate a permission issue.

**Alternatives and exceptions:** invalid credentials or inactive status deny sign-in; duplicate or unauthorised account changes are rejected; account rights do not grant academic-record editing. **Postcondition:** a valid session or account change is recorded, an audit view is returned, or access is denied with no protected data exposed. **Trace:** FR3-01, FR3-02; NFR3-01, NFR3-08, NFR3-09. **Open:** provisioning approval, account retention and audit visibility.

Teacher assignment to a subject, term and section belongs to the department HOD under FR3-03 and needs a separate flow from SC-08. Programme, subject, term and assessment setup authority still needs staff confirmation. Admin enrols Students within their programme but cannot assign Teachers.

## SC-09 — Answer student-support questions (conceptual)

**Proposed actors:** Student and assigned Teacher. **Trigger:** student support questionnaire. **Proposed result:** a non-diagnostic signal might be produced by AI and shown in the assigned Teacher's student profile, subject to institutional purpose, consent, qualified review, access, retention and referral rules. The question set, mandatory status, algorithm, threshold, disclosure, and human-review workflow are **unresolved**. This is a conceptual analysis path in the diagrams, with no prototype data collection or implementation. **Trace:** FEAT-24; no approved FR3 requirement.
