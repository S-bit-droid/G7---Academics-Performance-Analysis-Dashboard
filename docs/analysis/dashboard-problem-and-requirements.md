# Academic Performance Analytics Dashboard Problem Statement and Requirements

## Problem statement

Students currently obtain marks and attendance through separate channels. In the reported workflow, a subject teacher grades answer scripts, keeps each student's marks in a subject-wise Excel workbook and forwards that workbook to the Controller of Examinations office for publication on the university portal. Monthly subject attendance lists are displayed on the department website. One student's account describes occasional missing attendance displays and timeouts when many students open the marks portal at once. The cause and frequency of those failures have not been independently verified, and faculty interviews indicate that record and publication practices may vary by context.

The separation makes it harder for students to see marks, attendance and changes in performance together. In a questionnaire with 60 submissions, 32 respondents selected information being in different places, 31 selected late results or attendance updates, and 22 selected difficulty tracking progress. These responses support a combined academic view, but do not establish exact calculation rules or institution-wide system faults. Faculty interview themes include interest in individual and class views, comparisons, source accuracy and useful summaries; some teachers also consider their present record work manageable. The dashboard should therefore improve access and interpretation without assuming every current step is inefficient or inaccurate.

Group 7 proposes one coherent Academic Performance Analytics Dashboard for Students, Teachers, HOD and Admin. A Teacher will reuse the existing Excel **marks** workbook rather than enter marks a second time. For attendance, the assigned Teacher will choose either a Google Sheet that the dashboard reads automatically or a separate dated-column Excel **attendance** workbook uploaded to the dashboard. Both routes must associate entries with the right student, subject and session, prevent duplicate counts, identify missing or stale data and retain correction history. Released results will support student progress views, authorised class and department analysis, subject indicators and consistent reports. The selected scope also includes profiles, quizzes, academic work, questions, a shared calendar, notifications and explainable academic guidance.

The dashboard will not replace the university or department websites or submit records to the Controller's office. Its demonstration may use documented OULAD assessment examples and clearly labelled simulated classroom records; OULAD activity clicks are not physical attendance. Sensitive wellbeing assessment (FEAT-24) remains an analysis concept without a present implementation commitment. Before approval, the group must verify academic formulas, data templates, access authority, import behaviour and quality targets with responsible staff. Success should be judged through traceable, correctly scoped records and reports, not by claiming that charts alone improve student outcomes.

## Problem focus and checkable objectives

These seven points separate reported needs from design risks. They do not claim that the current university records are inaccurate.

| ID | Problem or risk and evidence status | Proposed outcome to check |
| --- | --- | --- |
| P-01 | Marks and attendance are in separate places; 32/60 student respondents selected this difficulty. | One permitted Student view shows both, with source labels. |
| P-02 | Updates are perceived as late by 31/60; one student also reported intermittent attendance display and marks-portal timeouts. Technical causes are unverified. | Views show last successful source update and distinguish unavailable from zero. |
| P-03 | Tracking progress is difficult for 22/60 respondents. | Subject trends show exact, comparable assessment values and missing-data labels. |
| P-04 | Cross-subject comparison is difficult for 17/60 respondents and appears in faculty themes. | Assigned Teachers and Students see only valid, labelled comparisons within their access scope. |
| P-05 | Faculty describe value in individual/class summaries, though practices and perceived difficulty vary. | Assigned class views and reports agree on counts and calculations. |
| P-06 | Two alternative attendance sources create a **design risk**, not a documented current-system fault: sessions could be duplicated or lost when a source changes. | Repeat-import and source-switch fixtures retain one result per student/session and a revision trail. |
| P-07 | Exact release/correction and cross-subject access authority remains **unvalidated**. | A reviewed permission matrix defines allowed and denied actions before implementation. |

## Scope and interpretation

The 25 functional requirements below describe the **proposed current application scope**, not a claim that every feature has been implemented or institutionally approved. The ADIS handout permits a smaller connected prototype while requiring consistent analysis and design. There is no separate MVP feature plan. FEAT-24 remains an analysis concept with unvalidated rules; diagram notation does not indicate implementation timing. No public self-registration, student-entered official marks, live portal integration, biometric attendance, health-data collection or paid service is planned.

`Student` can see their own released academic data and edit their self-reported profile. An assigned `Teacher` can edit only their own subject records and read released academic results across subjects for their assigned students. `HOD` is a department-limited appointment held by a Teacher; Admin promotes an existing Teacher, with one current HOD per department, and replacing the holder removes the former HOD's extra access. `Admin` manages accounts and setup, without automatic academic edit rights. Precise field and operation permissions remain open for staff validation. For attendance, **one source is active per subject/section/term**; source switches must reconcile by student identifier and session date and retain history.

## Functional requirements

Each statement is proposed. The last column names the principal evidence to prepare for acceptance; exact university rules marked open below must be settled before approval.

| ID | Proposed system requirement | Feature link | Acceptance evidence to prepare |
| --- | --- | --- | --- |
| FR3-01 | Authenticate provisioned accounts, provide logout and block protected requests after logout. | FEAT-01 | Valid, invalid and logged-out request checks. |
| FR3-02 | Enforce Student, Teacher, appointed-HOD and Admin permissions by operation, assigned teaching group, department and student record. Admin shall appoint or replace a department HOD only from its existing Teachers; HOD privileges shall end when the appointment ends, while Teacher access remains. Include Teacher own-subject edit versus assigned-student cross-subject read. | FEAT-01, 08, 12–13 | Permission tests for promotion, replacement, former-HOD access and one current HOD per department; exact academic authority open. |
| FR3-03 | Let HOD assign Teachers to subject/term/section groups within their department, and Admin enrol Students within their programme. Let authorised setup users manage programmes, terms, subjects and assessment definitions while preserving relevant history; authority for those other setup actions remains to be confirmed. | FEAT-02 | HOD department-scope, Admin programme-scope, setup/edit and historical-link checks. |
| FR3-04 | On first sign-in, let a Student complete and later update a self-reported profile covering high school, intermediate, interests and, for a Master's student, bachelor's background; let assigned Teachers view it read-only. | FEAT-18 | UG/PG field and scoped-edit/read checks; exact fields/optionality open. |
| FR3-05 | Let the assigned Teacher set the subject's combined Sessional 1/2 method to **sum or average**, recording the chosen method with its assessment context. | FEAT-02, 05 | Method-change and subject-scope tests; maxima/absent rules open. |
| FR3-06 | Let an assigned Teacher upload the existing examination-office Excel **marks** workbook, map student and assessment identifiers, preview rows and reject invalid/unmatched data before import. | FEAT-03–04 | De-identified workbook with valid, duplicate, missing and invalid rows. |
| FR3-07 | Let an assigned Teacher choose **Google Sheets sync or Excel attendance upload** as the single active attendance source for a subject/section/term, recording source changes. | FEAT-03, 17 | Source-selection and unauthorised-switch tests. |
| FR3-08 | Read a linked authorised Google Sheet on the agreed trigger, map dated attendance cells to students/sessions and record success, failure and last successful sync. | FEAT-03, 11, 17 | Changed, unchanged, blank and failed-sync fixtures; cadence open. |
| FR3-09 | Let an assigned Teacher upload and preview a dated-column Excel **attendance** workbook, validate it and re-upload corrections without requiring dashboard tick entry. | FEAT-03, 17 | Valid/invalid workbook and corrected re-upload examples. |
| FR3-10 | Apply the same identifier, attendance-code and session-date validation to either attendance route; reconcile source switches without counting the same student's session twice. | FEAT-03–04, 17 | Switch/re-import fixture checks counts and source/version history. |
| FR3-11 | Keep actor, time, source, version and reason for authorised marks and attendance corrections; prevent unintended duplicate rows on repeat imports. | FEAT-04, 11 | Correction and idempotent-repeat checks. |
| FR3-12 | Separate draft/unreleased records from Student-visible released records and restrict release or reopening to the authorised academic role. | FEAT-04, 06 | Draft/visible and denied-release checks; authority open. |
| FR3-13 | Show Sessional 1 and 2 separately, calculate only the Teacher-selected combined result, label its method and flag a discrepancy with an imported total. | FEAT-05–07 | Worked sum/average and mismatch examples. |
| FR3-14 | Calculate selected-month and cumulative term-to-date subject attendance from counted sessions for either source; distinguish blank/unrecorded, absent and unavailable denominators. | FEAT-05–06, 11 | Worked attendance and zero-denominator examples; excused-session rule open. |
| FR3-15 | Show a Student's released marks, attendance, coverage, calendar and notices together; show a marks warning only for a Master's sessional below **15/30** and an individual attendance warning only below **30%** when valid current data exist. | FEAT-06, 14, 29–30 | UG/PG, threshold, missing/stale and no-warning boundary checks. |
| FR3-16 | Show subject-level results and comparable progress over assessments/periods with exact values and labels for missing or incomparable data. | FEAT-07 | Comparable/incomparable fixture review. |
| FR3-17 | Show a Teacher's assigned class by subject, section and term, with counts/coverage and read-only comparison of an assigned student's released results in other subjects. | FEAT-08, 13 | Assigned/unassigned, edit-versus-read and differing-maxima checks. |
| FR3-18 | Show class average, assessed-student count and applicable below-cutoff count for subject review, and authorised HOD department summaries without attributing causes or Teacher quality. | FEAT-09, 12 | UG/PG, sample-size, department-scope and no-data examples. |
| FR3-19 | Generate a Student one-page PDF and authorised class/department reports using the same released values, rules and filters as the dashboard. | FEAT-10 | Dashboard-to-report value comparison and role tests. |
| FR3-20 | Let an assigned Teacher create, configure and publish a timed MCQ quiz with questions, count and timer, separate from official sessional marks. | FEAT-19 | Authorisation, publication and invalid-configuration checks. |
| FR3-21 | Let an eligible Student attempt a published quiz and view the result under the configured timer and attempt rules. | FEAT-19 | Completion, timeout and denied-access cases; attempt policy open. |
| FR3-22 | Let a Student upload/update academic work, links and achievements, distinguishing self-declared from Teacher-verified items and excluding lab tracking. | FEAT-20 | Own/other record, file/link and verification checks; limits open. |
| FR3-23 | Let a Student send a scoped academic question or dashboard feedback to an assigned Teacher, and let that Teacher reply/close it without silently altering official marks. | FEAT-15 | Message-scope, reply/closure and record-dispute checks. |
| FR3-24 | Publish a shared calendar for authorised Teacher sessionals/assignment deadlines and HOD events; send relevant **in-app** notices for those items, quizzes and an individual Student's low attendance, avoiding duplicates on resync. | FEAT-29–30 | Audience, update/cancel, duplicate and read-state checks; timing open. |
| FR3-25 | Offer a Student personalised **academic** guidance based on permitted released marks, attendance and quiz results, with supporting data and a checkable explanation; never alter official grades. | FEAT-22 | Relevant/irrelevant, missing-data and explanation review; free model/fallback and evaluation open. |
| FR3-26 | Let Admin create Student, Teacher, HOD and Admin accounts manually or from a role-specific CSV; validate fields, duplicate identifiers and existing academic scope before creation, preview CSV rows, set programme/department account scope, enrol Students in teaching groups, send invitation emails and show account plus basic usage summaries. Let HOD assign Teachers to subject/term/section groups in their department. Do not email passwords. | FEAT-01 | Valid/invalid CSV, duplicate, department/programme scope, failed-invitation, Admin-only account access and HOD-only Teacher-assignment checks; bulk email delivery configuration open. |

## Non-functional requirements

These ten quality requirements need numeric targets or concrete operating limits where marked **TBD**. They are not claims that a particular host or model already meets them.

| ID | Proposed quality requirement | Verification / open target |
| --- | --- | --- |
| NFR3-01 | Enforce authentication and scoped authorisation on the server for every protected read, write and export. | Role/record matrix with denied direct-request tests; final matrix TBD. |
| NFR3-02 | Minimise and separate personal data; do not expose identifiable academic data to unapproved hosted AI, and do not collect FEAT-24 health responses in the current build. | Data-flow/access review and no-health-data check. |
| NFR3-03 | Make imports, corrections, calculations and reports deterministic and consistent across both attendance routes; prevent duplicate student-session results. | Fixed fixtures, repeated imports, source-switch and report comparisons. |
| NFR3-04 | Validate file type, structure and size before processing; reject unsafe or malformed uploads without executing workbook content. | Malformed, oversized and unexpected-file checks; accepted limits TBD. |
| NFR3-05 | Preserve the last valid academic record when a Sheet sync or workbook upload fails; label source and freshness and suppress warnings from missing/stale data. | Failure/recovery cases; freshness interval TBD. |
| NFR3-06 | Meet agreed response-time and availability targets for the demonstration cohort and report generation. | Load/availability measurements; cohort, percentile and targets TBD in TELOS. |
| NFR3-07 | Provide understandable labels, errors and keyboard-usable core tasks for Student and Teacher workflows. | Representative task/accessibility review; task criteria and target TBD. |
| NFR3-08 | Keep a reviewable audit trail for imports, source switches, releases, corrections and relevant role changes. | Trace an example change to actor, time, source and before/after version. |
| NFR3-09 | Provide documented backup and restore for committed records and uploaded files under the selected zero-cost deployment. | Restore exercise; frequency and recovery targets TBD. |
| NFR3-10 | Keep rule definitions, import mappings, permissions and diagram/requirement links maintainable and traceable across changes. | Review a changed rule and its affected view, report, model and test. |

**Project constraint CON-01:** Implementation and demonstration must require **no payment**. Hosting, storage, Sheets access and any academic AI option must be checked for zero-out-of-pocket feasibility; no paid API or automatic paid spillover is assumed. This is a constraint to verify in TELOS, not proof of free capacity or reliability.

## Additional concept and decisions before approval

**FUT-01 (FEAT-24, analysis/design only):** The proposed Student wellbeing questionnaire, non-diagnostic AI support signal, human/access gate and possible assigned-Teacher profile view may be represented where relevant in conceptual models, without a separate implementation-status label in the drawing. This is **not** a current functional requirement or implementation commitment. Mandatory participation, instrument, purpose, consent/access, confidentiality, retention, qualified review and referral need institutional decisions before any implementation. No real health responses or AI health labels belong in the current prototype.
