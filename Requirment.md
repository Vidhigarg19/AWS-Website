You are acting as a Senior Full-Stack Software Architect, Backend Engineer, Database Architect, UI/UX Engineer, Security Engineer, and DevOps Engineer.

I already have an existing AWS Student Builder Group website/project. DO NOT rewrite the existing application from scratch.

Your first responsibility is to inspect the existing repository, understand the current architecture, identify the existing certificate-generation system, existing routes, existing database setup, existing authentication if any, and existing deployment configuration.

We are going to implement a clean Event + Attendance + Certificate + Verification + Admin system.

IMPORTANT:
- Do NOT build the whole system in one go.
- Work strictly phase-by-phase.
- After completing each phase, validate it before moving to the next phase.
- Do not unnecessarily introduce new technologies if the existing project already has suitable technologies.
- Reuse existing components, utilities, styles, database setup, certificate-generation logic, and infrastructure wherever practical.
- Preserve the current website and its existing functionality.
- Do not delete working functionality unless explicitly required.
- Before making major architectural changes, explain what you found in the repository and what you intend to change.
- Keep the implementation simple and production-oriented.
- Avoid overengineering.

==================================================
1. FINAL SYSTEM OBJECTIVE
==================================================

The final system should support the following workflow:

ADMIN
  ↓
Create/Edit Event
  ↓
Configure the current attendance event
  ↓
Attendance Portal dynamically displays event name + date + timing
  ↓
Student opens Attendance Portal
  ↓
Student enters:
    - Full Name
    - Email
    - Course
    - Roll Number
  ↓
Student submits attendance
  ↓
Participant data is stored in DB
  ↓
Attendance record is stored in DB
  ↓
Certificate is generated automatically using the existing certificate-generation system
  ↓
Certificate ID is generated and stored
  ↓
Certificate PDF information is stored
  ↓
Student gets a certificate confirmation page
  ↓
Admin Portal shows participant details according to event
  ↓
Admin can later send certificates to the stored email addresses
  ↓
Anyone can verify a certificate using Certificate ID
  ↓
Verification Portal fetches the official certificate record from the database
  ↓
Verification page displays the certificate and relevant participant/event/certificate information

==================================================
2. IMPORTANT SCOPE DECISIONS
==================================================

For the current implementation:

DO NOT create:
- Registration system
- Separate event registration workflow
- Multiple attendance checkpoints
- Complex attendance approval workflow
- Certificate status enum
- Attendance status enum
- Event status enum
- Analytics dashboard
- Student password/account system
- Advanced role management unless already required by the existing application
- Unnecessary audit-log system
- Unnecessary timestamps
- Unnecessary tables
- Unnecessary microservices

This is an MVP focused on:
1. Event management
2. Current event configuration
3. Attendance collection
4. Participant storage
5. Certificate generation
6. Certificate storage/record
7. Admin participant view
8. Certificate email sending
9. Certificate verification

==================================================
3. FINAL DATABASE SCHEMA
==================================================

Completely replace/clean up the relevant existing schema if required.

Use the following logical schema.

------------------------------------------
TABLE: participants
------------------------------------------

Fields:

id
full_name
email
course
roll_no

Requirements:
- id = primary key
- email should be unique
- Do NOT store college_name
- Do NOT collect unnecessary personal information
- Do NOT add created_at or updated_at

Example:

id:
student UUID

full_name:
Piyush Rawat

email:
piyush@example.com

course:
B.Tech CSE

roll_no:
202609018


------------------------------------------
TABLE: events
------------------------------------------

Fields:

id
name
description
event_date
event_timing
speaker_name
attendance_open

Requirements:
- id = primary key
- event_timing must be one display-oriented field, not separate start_time/end_time
- event_timing can be stored as TEXT/VARCHAR
- Do NOT add start_time
- Do NOT add end_time
- Do NOT add created_at
- Do NOT add updated_at
- attendance_open controls whether attendance can currently be submitted

Example:

id:
event UUID

name:
Cloud Kickstart 2026

description:
Getting Started with AWS

event_date:
2026-09-30

event_timing:
11:00 AM - 12:30 PM

speaker_name:
Mr. Aashu Dev

attendance_open:
true


------------------------------------------
TABLE: attendance
------------------------------------------

Fields:

id
event_id
participant_id
submitted_at

Requirements:
- id = primary key
- event_id = foreign key to events.id
- participant_id = foreign key to participants.id
- submitted_at is required
- Add a unique constraint/index on:
    event_id + participant_id
- This prevents the same participant from submitting attendance multiple times for the same event
- Do not add attendance status enums

------------------------------------------
TABLE: certificates
------------------------------------------

Fields:

id
certificate_id
event_id
participant_id
attendance_id

recipient_name_snapshot
event_name_snapshot
event_date_snapshot

pdf_url
verification_url
pdf_hash

issue_date

Requirements:
- id = primary key
- certificate_id must be UNIQUE
- event_id = foreign key to events.id
- participant_id = foreign key to participants.id
- attendance_id = foreign key to attendance.id
- Do NOT add sent_at
- Do NOT add created_at
- Do NOT add updated_at
- Do NOT add certificate status enum
- Do NOT add unnecessary fields

IMPORTANT:
The snapshot fields are required:
- recipient_name_snapshot
- event_name_snapshot
- event_date_snapshot

These preserve exactly what was issued on the certificate even if an event or participant record is edited later.

pdf_url stores the certificate PDF location.

verification_url stores the public certificate verification URL.

pdf_hash stores the SHA-256 hash if supported by the existing certificate-generation/storage implementation.


------------------------------------------
TABLE: portal_config
------------------------------------------

Fields:

id
active_event_id
attendance_enabled

Requirements:
- id = primary key
- active_event_id = foreign key to events.id
- attendance_enabled controls whether the Attendance Portal accepts submissions
- Do NOT add updated_at
- Do NOT add updated_by
- There should be one effective portal configuration record for the Attendance Portal

==================================================
4. DATABASE RELATIONSHIPS
==================================================

Implement these relationships:

events
  |
  ├── has many attendance records
  |
  └── has many certificates

participants
  |
  ├── has many attendance records
  |
  └── has many certificates

attendance
  |
  └── belongs to one event
  └── belongs to one participant
  └── can have one certificate

certificates
  |
  ├── belongs to one event
  ├── belongs to one participant
  └── belongs to one attendance record

portal_config
  |
  └── references the currently active event

The database should be normalized and should avoid unnecessary duplication.

Do NOT store event_name, event_date, or participant_name repeatedly inside attendance.

Use foreign keys and relationships.

==================================================
5. VERY IMPORTANT: ACTIVE EVENT LOGIC
==================================================

The Attendance Portal must NOT hard-code:
- Event name
- Event date
- Event timing
- Speaker

These values must come from the database.

The flow must be:

Admin Portal
  ↓
Create/Edit event
  ↓
Configure the event as the current attendance event
  ↓
portal_config.active_event_id
  ↓
Attendance Portal fetches active_event_id
  ↓
Backend retrieves the matching event
  ↓
Attendance Portal displays:
    event name
    event date
    event timing
    speaker if required

IMPORTANT:
Do not create a visible "Select Event" workflow/button.

The Admin Portal should only expose:
- Create Event
- Edit Event

The concept of the active event must still exist internally through portal_config.active_event_id.

If the UI needs to change the active event, implement that through the event creation/edit workflow rather than introducing a separate "Select Event" interface.

==================================================
6. ADMIN PORTAL
==================================================

Build the Admin Portal around two main sections.

------------------------------------------
SECTION A — CURRENT / UPCOMING EVENT
------------------------------------------

The admin should be able to:

- Create Event
- Edit Event
- Configure the current attendance event through the event management workflow
- Enable/disable attendance

Display:

Current Event

Event Name
Event Date
Event Timing
Speaker Name
Attendance Enabled/Disabled

The event information shown here must come from the database.

------------------------------------------
SECTION B — PARTICIPANT DETAILS
------------------------------------------

Display participants according to event.

The admin should be able to select an event context through the page's event view/filtering mechanism, but DO NOT create a separate "Select Event" button for changing the portal's active event.

The participant table should show only:

Name
Email
Course
Roll Number
Attendance Submitted At
Certificate ID

DO NOT show:
- Certificate Status
- Actions column
- Generate button
- Send button
inside the main participant table unless later explicitly requested.

Keep this page focused on viewing participant information.

At the top, display:

Total Participants Attended

This should be calculated from attendance records.

Do not manually maintain a participant count if it can be derived reliably from attendance records.

==================================================
7. ATTENDANCE PORTAL
==================================================

Create/update the student-facing Attendance Portal.

The page must dynamically load the active event.

On page load:

GET active portal configuration
  ↓
get active_event_id
  ↓
get event
  ↓
display event information

The page should display:

AWS Student Builder Group branding

Event Name
Event Date
Event Timing
Speaker Name if needed

Then show the attendance form.

FORM FIELDS:

1. Full Name *
2. Email *
3. Course *
4. Roll Number *

Do not ask for:
- College
- Phone number
- Address
- DOB
- Aadhaar
- unnecessary personal data

Add helper text:

"Enter your name exactly as you want it to appear on your certificate."

The form should be responsive and optimized for mobile because students will access it through a QR code during/after the webinar.

==================================================
8. ATTENDANCE SUBMISSION FLOW
==================================================

When the student submits:

POST attendance

The backend must:

1. Fetch the active event from portal_config.
2. Verify that attendance is enabled.
3. Validate the submitted student information.
4. Find the participant using email.
5. If participant does not exist, create participant.
6. If participant already exists, use the existing participant record.
7. Check whether attendance already exists for:
       event_id + participant_id
8. If duplicate attendance exists:
       do NOT create another attendance record.
9. Create attendance record.
10. Generate certificate ID.
11. Generate verification URL.
12. Call the existing certificate-generation system.
13. Generate certificate PDF.
14. Generate QR code containing the verification URL.
15. Store certificate information in the certificates table.
16. Return successful certificate information to the frontend.

The client must NOT be trusted to determine the event_id.
The backend must determine the active event.

==================================================
9. CERTIFICATE GENERATION
==================================================

There is already an existing certificate-generation system in the project.

IMPORTANT:
Do not rebuild it unnecessarily.

First inspect the existing generator.

Determine:
- how participant name is passed
- how event name is passed
- how event date is passed
- how certificate ID is generated
- how QR code is generated
- how PDF is generated
- where PDF is stored
- whether PDF hashing already exists

Refactor only if required so the generator can be called programmatically from the attendance workflow.

Dynamic certificate fields must include:

Participant Name
Event Name
Event Date
Certificate ID
Verification QR / Verification URL

The existing certificate design should be preserved unless a technical change is required.

The certificate template currently follows the AWS Student Builder Group design and contains the recipient, event, date, certificate ID, and verification QR/URL structure. Use the existing implementation/template rather than designing a completely new certificate.

Example certificate ID:

AWS-SBG-2026-GKTZ4W

Example verification URL:

https://<existing-domain>/verify/AWS-SBG-2026-GKTZ4W

The QR code must contain the verification URL, not raw participant information.

==================================================
10. CERTIFICATE DATABASE RECORD
==================================================

After the PDF is generated, create the certificate database record.

Store:

certificate_id
event_id
participant_id
attendance_id

recipient_name_snapshot
event_name_snapshot
event_date_snapshot

pdf_url
verification_url
pdf_hash
issue_date

The certificate record must correspond exactly to the generated certificate.

The certificate ID must be globally unique.

==================================================
11. STUDENT CONFIRMATION PAGE
==================================================

After successful attendance submission and certificate generation, display a polished success page.

Suggested content:

Attendance Confirmed

Thank you, [Student Name]!

Your participation in [Event Name] has been recorded and your certificate has been generated successfully.

Certificate ID:
AWS-SBG-2026-XXXXXX

Buttons:

Download Certificate
View Certificate
Verify Online

Do NOT say:
"Your certificate has been downloaded"

unless the browser actually downloaded the file.

Keep Copy Certificate ID / Copy Verification Link functionality if already implemented and useful.

==================================================
12. EMAIL CERTIFICATE SYSTEM
==================================================

Implement certificate email sending as a separate capability.

The email workflow should use the participant email stored in the database.

Admin should eventually be able to trigger:

Send Certificate

or a bulk:

Send Certificates

Do not store sent_at in the certificates table.

Since sent_at has explicitly been removed from the schema, do not create a new timestamp field for it.

For this MVP, email delivery can be performed without adding delivery-state fields to the database.

The email should contain:

- Student name
- Event name
- Thank-you message
- Certificate PDF attachment
- Verification information
- AWS SBG branding

The actual email provider must use whatever service is already available in the project/environment.

Do not introduce a new email provider until inspecting the existing project.

==================================================
13. VERIFICATION PORTAL
==================================================

Create/update:

/verify

The user should be able to enter:

Certificate ID

Example:

AWS-SBG-2026-GKTZ4W

Then submit.

Backend must perform the lookup.

DO NOT trust certificate information coming from the frontend.

Backend flow:

certificate_id
  ↓
certificates table
  ↓
participant record
  ↓
event record
  ↓
verification response

For a valid certificate, display:

VERIFIED

Official AWS SBG Certificate

Recipient:
Name

Course:
Course

Roll Number:
Roll Number

Event:
Event Name

Event Date:
Event Date

Certificate ID:
Certificate ID

Issue Date:
Issue Date

Issued By:
AWS Student Builder Group
Tulas University

Certificate Preview

Download Certificate

IMPORTANT:
Do not expose internal database IDs.

Also be careful about publicly exposing personal information such as email addresses. By default, do not expose a student's full email address publicly unless this is explicitly required. Name, course, roll number, event, date, and certificate details are sufficient for verification.

==================================================
14. QR VERIFICATION FLOW
==================================================

The QR code on every certificate should point to:

/verify/{certificate_id}

Example:

/verify/AWS-SBG-2026-GKTZ4W

Scanning the QR must open the verification page for that certificate.

The verification page must retrieve the actual certificate data from the database.

==================================================
15. VERIFICATION STATES
==================================================

Do not implement certificate status enums.

However, the verification endpoint/page must handle at least:

VALID CERTIFICATE:
Certificate ID exists and matches a valid certificate record.

NOT FOUND:
Certificate ID does not exist.

Do not invent a certificate if the ID is invalid.

If later certificate revocation is required, design the architecture so it can be extended, but do NOT add a certificate status field now.

==================================================
16. API DESIGN
==================================================

Adapt API naming to the existing project, but the logical endpoints should cover:

PUBLIC / STUDENT:

GET    /api/attendance/config

POST   /api/attendance

GET    /api/certificates/:certificateId

GET    /api/verify/:certificateId


ADMIN:

GET    /api/admin/events

POST   /api/admin/events

PUT    /api/admin/events/:id

GET    /api/admin/events/:id/participants

POST   /api/admin/certificates/send

If the project has a better established routing structure, use that rather than blindly copying these exact URLs.

==================================================
17. EVENT DATA FLOW
==================================================

The Admin creates an event:

name
description
event_date
event_timing
speaker_name
attendance_open

The admin then configures which event is currently active through the existing admin workflow.

The backend stores:

portal_config.active_event_id

Attendance Portal loads the active event.

This means changing the current event does NOT require changing frontend code.

For example:

Current event:
Cloud Kickstart 2026

Later:

Current event:
AWS AI & ML Workshop

The Attendance Portal should automatically display the new event after the admin updates the configuration.

==================================================
18. EVENT PARTICIPANT COUNT
==================================================

Do NOT add participant_count to the events table in the initial implementation.

The number of participants attended should be derived from:

attendance records for that event.

For example:

COUNT(attendance.id)
WHERE event_id = current event

Display this value in the Admin Portal as:

Participants Attended: 87

This avoids duplicated data becoming inconsistent.

==================================================
19. UI/UX REQUIREMENTS
==================================================

Use the existing design system wherever available.

The system should feel like one unified AWS SBG platform.

General style:
- Premium
- Modern
- Minimal
- Technical
- Clean
- Responsive
- Mobile-first for Attendance Portal
- Professional for Admin Portal
- Trust-focused for Verification Portal

Do not unnecessarily redesign the entire website.

Reuse:
- Existing typography
- Existing colors
- Existing components
- Existing layout primitives
- Existing navigation if appropriate

The verification page should prioritize:
1. Verification result
2. Recipient
3. Event
4. Certificate ID
5. Certificate preview
6. Download/verification actions

==================================================
20. SECURITY REQUIREMENTS
==================================================

Implement sensible baseline security.

Requirements:

- Validate all user inputs server-side.
- Never trust event_id supplied from the frontend.
- Active event must come from portal_config.
- Prevent duplicate attendance for same event + participant.
- Sanitize names and text inputs.
- Validate email format.
- Prevent SQL injection using the project's ORM/query parameterization.
- Never expose internal database IDs publicly.
- Certificate verification must query the database.
- QR must contain verification URL, not participant personal information.
- Protect admin endpoints using the project's existing authentication mechanism if one exists.
- Do not expose database credentials or email credentials to frontend code.
- Keep secrets in environment variables.

==================================================
21. DUPLICATE PARTICIPANT LOGIC
==================================================

Use email to find an existing participant.

Example:

Existing:
Piyush Rawat
piyush@example.com

Later the same student attends another event.

Do NOT create a second participant record.

Reuse the existing participant.

Create a new attendance record for the new event.

This gives each participant a long-term history across SBG events.

==================================================
22. MIGRATION STRATEGY
==================================================

Before modifying the database:

1. Inspect the current schema.
2. Document existing tables.
3. Identify which tables can be reused.
4. Identify which tables are conflicting with the new design.
5. Create a migration plan.
6. Backup/export existing data if appropriate.
7. Then apply schema changes.

Do NOT silently destroy existing useful data.

If the current database is only test/development data, it may be reset after inspection.

==================================================
23. IMPLEMENTATION PHASES
==================================================

Work in the following exact order.

------------------------------------------
PHASE 0 — REPOSITORY DISCOVERY
------------------------------------------

Do NOT code immediately.

Inspect:
- project structure
- frontend
- backend
- ORM
- database
- current certificate generator
- storage
- email integration
- authentication
- environment variables
- existing routes
- existing UI components
- deployment

Deliver a short technical report containing:
- current stack
- current architecture
- current DB schema
- certificate generation flow
- files that need modification
- files that can be reused
- risks/conflicts

STOP and wait for approval before major implementation changes.


------------------------------------------
PHASE 1 — DATABASE REBUILD
------------------------------------------

Implement:

participants
events
attendance
certificates
portal_config

Apply the exact schema described above.

Add:
- primary keys
- foreign keys
- required fields
- unique constraints
- event_id + participant_id unique constraint
- certificate_id unique constraint

Do not add enums.

Do not add timestamps that were explicitly removed.

Run migration and test database relations.

Acceptance criteria:
- schema created successfully
- relations work
- duplicate attendance prevented
- certificate ID uniqueness enforced


------------------------------------------
PHASE 2 — ADMIN EVENT MANAGEMENT
------------------------------------------

Build the Admin Portal event section.

Implement:
- Create Event
- Edit Event
- Current event configuration
- Attendance enable/disable

Do NOT add a separate Select Event button.

Acceptance criteria:
Admin can create an event and configure it as the active attendance event.

------------------------------------------
PHASE 3 — DYNAMIC ATTENDANCE PORTAL
------------------------------------------

Connect Attendance Portal to portal_config.

Implement:
- fetch active event
- display event name
- display date
- display timing
- display speaker if needed
- attendance form
- validation
- mobile responsiveness

Acceptance criteria:
Changing the event in Admin Portal automatically changes the Attendance Portal without frontend code modification.


------------------------------------------
PHASE 4 — ATTENDANCE BACKEND
------------------------------------------

Implement:
- participant lookup/create
- attendance creation
- duplicate protection
- active event validation

Acceptance criteria:
Student submission creates correct participant and attendance records.


------------------------------------------
PHASE 5 — CERTIFICATE GENERATION INTEGRATION
------------------------------------------

Inspect and reuse the existing certificate generator.

Connect it to attendance submission.

Implement:
- certificate ID generation
- QR generation
- verification URL
- PDF generation
- PDF storage
- certificate database record
- snapshot fields
- issue date
- PDF hash if supported

Acceptance criteria:
A real attendance submission produces a real certificate tied to the correct participant and event.


------------------------------------------
PHASE 6 — STUDENT SUCCESS PAGE
------------------------------------------

Implement:
- Attendance Confirmed
- Student name
- Event
- Certificate ID
- Download Certificate
- View Certificate
- Verify Online

Acceptance criteria:
Student can immediately access the generated certificate.


------------------------------------------
PHASE 7 — ADMIN PARTICIPANT VIEW
------------------------------------------

Build the participant section.

Admin can view participants by event.

Display:
- name
- email
- course
- roll number
- attendance submission time
- certificate ID

Display:
Total Participants Attended

Do not add:
- certificate status
- actions column

Acceptance criteria:
Admin sees database-backed participant information for the selected event context.


------------------------------------------
PHASE 8 — EMAIL CERTIFICATE DELIVERY
------------------------------------------

Implement certificate sending.

Flow:

Admin
  ↓
Send Certificate
  ↓
Backend fetches certificate
  ↓
Fetch participant email
  ↓
Fetch PDF
  ↓
Send email

Implement bulk sending if practical after the single-send flow works.

Do not add sent_at to DB.

Acceptance criteria:
A test participant receives the correct certificate PDF at the email stored in the database.


------------------------------------------
PHASE 9 — VERIFICATION PORTAL
------------------------------------------

Implement:

/verify

and:

/verify/{certificate_id}

Implement:
- certificate ID search
- database lookup
- verified result
- recipient
- course
- roll number
- event
- event date
- certificate ID
- issue date
- issuer
- certificate preview
- download

Acceptance criteria:
A certificate QR scan opens its matching verification page.


------------------------------------------
PHASE 10 — END-TO-END TESTING
------------------------------------------

Create test data for at least 10-20 participants.

Test:

1. Admin creates event.
2. Admin configures active event.
3. Attendance Portal receives event dynamically.
4. Student submits attendance.
5. Participant is stored.
6. Attendance is stored.
7. Certificate is generated.
8. Certificate is stored.
9. Certificate ID is unique.
10. QR works.
11. Verification works.
12. Duplicate attendance is blocked.
13. Admin sees participant.
14. Email works.
15. Certificate downloads correctly.
16. Verification page displays correct details.

Test on:
- desktop
- mobile
- different browsers if practical


------------------------------------------
PHASE 11 — PRODUCTION HARDENING
------------------------------------------

Before production:
- environment variables verified
- database connection secured
- API validation complete
- admin protection verified
- storage permissions verified
- email credentials protected
- PDF generation tested
- QR verification tested
- production domain verified
- error handling improved
- loading states added
- empty states added
- mobile layout verified

Only after this should production deployment happen.

==================================================
24. GIT / DEVELOPMENT WORKFLOW
==================================================

Do not make giant commits.

Use logical commits such as:

feat: rebuild event and attendance schema
feat: add admin event management
feat: add dynamic attendance portal
feat: integrate certificate generation
feat: add certificate verification
feat: add certificate email delivery
test: add end-to-end attendance flow
fix: handle duplicate attendance

Do not mix unrelated changes into one commit.

Before merging any major feature:
- run tests
- run build
- check lint/type errors
- review affected routes/components

==================================================
25. IMPORTANT IMPLEMENTATION RULES
==================================================

1. Do not build everything in one go.
2. Finish and validate one phase before moving to the next.
3. Inspect the existing code before replacing anything.
4. Reuse the current certificate generator.
5. Do not introduce enums into the new schema.
6. Do not add timestamps that were explicitly removed.
7. Do not add a visible "Select Event" control.
8. Do not hard-code event details into the Attendance Portal.
9. Do not let the frontend decide the active event.
10. The backend/database must be the source of truth.
11. Do not duplicate participant/event information unnecessarily.
12. Preserve certificate snapshots for historical accuracy.
13. Do not expose internal database IDs.
14. Do not expose full email addresses publicly on certificate verification unless explicitly required.
15. Keep the implementation simple enough to maintain by the AWS SBG technical team.

==================================================
26. FINAL SUCCESS CRITERIA
==================================================

The implementation is complete only when this exact workflow works:

ADMIN
  ↓
Create/Edit Cloud Kickstart 2026
  ↓
Configure it as active attendance event
  ↓
ATTENDANCE PORTAL
  ↓
Dynamically shows:
Cloud Kickstart 2026
30 September 2026
Event timing
  ↓
Student enters:
Full Name
Email
Course
Roll Number
  ↓
SUBMIT
  ↓
Participant stored
  ↓
Attendance stored
  ↓
Certificate ID generated
  ↓
Certificate PDF generated
  ↓
Certificate record stored
  ↓
Student sees confirmation/download page
  ↓
ADMIN PORTAL
  ↓
Admin sees participants for the event
  ↓
Certificate can be sent by email
  ↓
VERIFICATION PORTAL
  ↓
Certificate ID entered
  ↓
Certificate record retrieved
  ↓
Participant + event + certificate details displayed
  ↓
QR on certificate opens the same verification page

Do not move to additional features until this end-to-end workflow is working correctly.

Start with PHASE 0 only.