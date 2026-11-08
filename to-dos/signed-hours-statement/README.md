---
name: "Signed hours statement: a worker's recorded hours on one job, as a paper they sign, for court"
number: 212
group: close
status: walked 2026-11-08 in the owner's Chrome on a ZZ Test job — the sub's sheet paper with its company, Sign here now, the signed PDF filed, Put in Sent by us, the dev MCP's sheet paper; two small things left (Where it stands) · the three residuals built 2026-11-07 — v2.6654 the dev MCP's charged and sheet papers (migration 20261107170000, server 0.39.0), v2.6660 the Legal desk's Ask… for a sub on the sheets, v2.6661 the company on a sub's attestation (labor_company) · the four residuals built 2026-11-07 — v2.6629 the signed PDF as the print with the charged basis, v2.6633 the Legal band's words for a role that cannot read, v2.6634 Put in Sent by us (migration 20261107130000), v2.6636 a sub's sheet lines through the window · PR 1 built 2026-10-29, v2.6069, the kernel, the Letter print and the reads · PR 2 built 2026-10-29, v2.6097, the window, the hours_statements table and the Hours statements section on the job's Documents tab and the person's desk, the dev press retired · the print restyled as one full-width paper 2026-11-02, v2.6412 · PR 3 built 2026-11-02, v2.6411, the signing: the statement as its own Contract Form, Send for signature… with the four channels, Sign here now, File a signed scan…, the signed PDF on the job and the desk · PR 4 built 2026-11-03, v2.6413, the matter: Signed statements under each job on the Evidence tab, Ask… per worker, Add to evidence, the exhibit, the gap jobs · PR 5 built 2026-11-03, v2.6414, the MCP: get_hours_statement, plan_hours_statement → apply_hours_statement (make, send, file_on_matter) over dev_hours_statement_write, server 0.20.0 · access narrowed 2026-11-03, v2.6450: a dev and the controller alone (Diane's call of 2026-11-02, payroll data), the section tagged Controllers and devs only
mockup: to-dos/signed-hours-statement/mockup.html
summary: >
  A paper, made from the clock and the pay reports as they stand, that says what one worker did on one
  job at one site in a period, what the company paid for it, and that the worker signs at the bottom,
  so that in a case over an unpaid bill the company can prove it paid for specific work on a specific
  site. Every job, the office job included. The app already holds every row, the pay report print, the
  ink-signing page the lien waivers use, and the Legal desk's Evidence tab; what is new is one builder,
  one window, one small table, and two verbs on the dev MCP so an agent can read and make one. The hard part is the span before the app: nothing in the app precedes
  2026-03-12, so for 2025 the paper can carry only what the worker states, marked as such.
next: Walked 2026-11-08 (Where it stands). Left, the owner's: **Open the signed PDF** drew no tab in Chrome when the popup was blocked and offered no fallback (Sign here now's *Open the signing page* dialog is the model) — one small PR; the Legal band's sub **Ask…** was read on a real account only, since no ZZ Test account sits in collections — he presses it on a live matter when one comes; counsel's note, if one comes, changes the stated block's words. Then the card's deletion.
size: M as a train of five (S · M · M · S · S) plus seven residuals (M · S · S · M · S · S · S), all built and walked; left: the signed PDF's fallback (XS)
blocker: none — the owner's call of 2026-11-07: counsel's word on the stated block's weight is not waited for; the block stays marked as the worker's own statement, and counsel notes anything later.
---

# Signed hours statement (#212)

## The ask

Taunya, 2026-10-29: *"From 2025-Q2 of 2026 we were not doing a great job recording. I think that we
should make a tool in the app, that allows us to make a contractors recorded hours for a job a print
out like a pay report where they can sign at the bottom their hours, I think this could be used in
court cases surrounding people not paying their bill where we as a company need to prove we paid for
specific work on a specific site. Do you think we could add this, I would need to be able to pull it
up for every job including the office job."*

On reading the card and the mock-up, the same day: *"I like the basis of this, let's remove the record column."* The
paper no longer carries a column saying how each row was recorded. Then, on the seven calls below: *"Yes, as
recommended."* All seven are decided. And then: *"I would like this accessable via MCP"*, so an
agent on the dev MCP can read a statement's rows, make one and file the signed copy on a matter.

## The answer

Yes, and the owner has decided every call, so it is ready to build. Every row the paper needs is in the app already, with its day, start, end, job, note and
approver; the pay report print, the ink-signing page a sub signs a lien waiver on, and the Legal
desk's per-job proof table exist; nothing new is needed in the database beyond one small table and
one column. The size is M as a train of four PRs. The two calls that shaped it were taken as recommended on
2026-10-29: the paper carries the pay, with a switch to leave it off, and a period the app never
recorded is attested by a block the worker fills in, marked *stated*, with counsel asked what such a
statement is worth before the signing ships. One fact shapes the whole thing: the app holds
**nothing before 2026-03-12** in any hours table, so for the 2025 span the paper is the worker's own
declaration and nothing else.

## What the app has today (verified 2026-10-29)

### The hours rows, per person per job

- **Punches and typed days**: `public.clock_sessions` (29 columns; the Row type in
  `src/types/database.ts`): `user_id`, `work_date`, `clocked_in_at`, `clocked_out_at`,
  `job_ledger_id` (or `bid_id`, never both), `notes` (*What are you working on?*), `origin`
  (`user_punch` or `salary_schedule`), `quick_add_minutes`, the in, out and arrival GPS with their
  source, `approved_at` / `approved_by`, `rejected_*`, `revoked_*`. The count rule everywhere is
  *not rejected, not revoked*; payroll and the lien clock add *approved*. The person key is the
  login (`users.id`), joined to the roster through `people.account_user_id`.
- **Approval** (`approve_clock_sessions`, latest body in `20261010022000_drop_team_leader_list.sql`)
  adds the hours into `people_hours`, a **daily** total per person with **no job column**
  (`person_name`, `work_date`, `hours`, `entered_by`, `person_id`), and rebuilds
  `people_crew_jobs.job_assignments` as `[{job_id, pct}]` per person per day. So the job is on the
  session, the day total on `people_hours`, and the share by job on the crew row.
- **Typed hours** (punch list #70, v2.4242): `clock_typed_entries` records each hand-typed stretch per
  person per day (`kind` added or trimmed, the range, who typed it, who confirmed it), with no job and
  no session id; `TypedHoursStamp` (`src/components/clock/TypedHoursStamp.tsx`) is the pencil.
- **Quick adds**: `add_quick_time(p_minutes, p_note, p_ended_at)` writes a 5 to 30 minute
  `user_punch` row onto the office job, unapproved, for the roles in `quick_add_roles_v1`.
- **Salaried people** (`docs/SALARY_CLOCK_SESSIONS.md`): the auto rows carry whatever job or bid the
  template or the day's override names, which can be none; they drive the calendar, not the pay, which
  is a flat 8 hours a weekday.
- **The office job**: `app_settings.overhead_office_job_ledger_id_v1` (`src/lib/appSettingsKeys.ts`,
  read by `readOverheadOfficeJobLedgerId`); an ordinary `jobs_ledger` row, so any punch, split, edit or
  template can land on it, and the quick adds always do.
- **Subs**: a sheet is `people_labor_jobs` (`job_ledger_id`, `assigned_to_name`, `job_date`,
  `labor_rate`, `invoice_link`, the stage and portal columns) with lines in `people_labor_job_items`
  (`fixture`, `count`, `hrs_per_unit`, `is_fixed`, `labor_rate`); hours are `count × hrs_per_unit`.
  **A sub never punches**: the hours are agreed units. The sub's person is
  `people_labor_job_assignees` (`labor_job_id`, `person_id`).
- **The rate**: `people_pay_config.hourly_wage` and `office_hourly_wage` hold the current value only;
  the rate on the day is snapshotted into `pay_stub_days.rate_at_time` (and the office/job split's
  `office_rate` / `job_rate`) when the pay report is made.
- **Readers to reuse**: `list_user_license_hours_log(p_user_id, p_start, p_end)` returns one row per
  approved session with the job's number, name and address (the License hours log; filter by job on
  the client); `fetchTeamLaborBreakdownForJob` (`src/utils/teamLabor.ts`) gives per person per day
  hours and cost, derived through the crew share; `jobHoursStory.ts` is a pure day → entries kernel with
  a print. **No RPC takes one person and one job over a range today.**
- **Who reads**: `clock_sessions` select is dev, payroll access (controller, pay-approved master),
  assistant, or one's own; `people_hours` and the pay-stub family are payroll access and assistant
  (wages payroll only). People → Hours is dev, controller, assistant (no wages, a rolling window) and a
  pay-approved master; Payroll is dev, controller and a pay-approved master.

### What proves the company paid

- **Pay reports**: `pay_stubs` (person, `period_start`, `period_end`, `hours_total`, `gross_pay`)
  with `pay_stub_days` (one row a day: hours and rate at the time, the office/job split) and
  **`pay_stub_payments`** (`amount`, `paid_at`, `memo`, `source_kind` cashapp · mercury · apple_pay ·
  client_direct · other, `source_id` the Cash App transaction id or the bank row). **Record payment**
  (`RecordPayStubPaymentModal.tsx`, `useRecordPayStubPayment.ts`) inserts the row; the Cash App
  reconcile and the pay agent (`docs/PAY_RECONCILE_AGENT.md`) stamp the source.
- **A payment ties to hours only by person and week**: `pay_stub_payments.pay_stub_id` →
  `pay_stubs` → the period's days. No `pay_stub_id` on a session or a `people_hours` row; the job is
  read at print time from `people_crew_jobs`. The pay report print (`buildPayStubHtml.ts`) already draws
  a day table with *Jobs / Bids* and a *Physical payments* list. So the paper can say *paid in full for
  the week of …, which covered every job that week*, and no more.
- **Subs**: `people_labor_job_payments` (`amount`, `payment_date`, `memo`, `hidden_from_sub`) is
  per sheet, so per job; there is no method or reference column, only the memo. The lien waiver a sub
  signs on payment is a Contract Form (`person_contract_documents` with the note `sheet:<id>`).
  Sub Labor settlement: `docs/RUN_SUBS_PLAN.md`.
- **The bank**: `mercury_transaction_job_allocations` moves cost to a job; a payroll send links only
  through `pay_stub_payments.source_kind = mercury` and its id; a sub payment has no bank link at all
  (`docs/COST_BATCHES.md`).
- **A pay statement exists** (`buildPayStatementHtml` in `src/lib/people/personMoneyLedger.ts`,
  the Offsets tab's *Pay statement*): every payment on record for a person, with the week's job lines
  summed; no memo, no method, no signature.

### Signing and printing to reuse

- **Two signing pages.** A customer signs a job contract on `/contract/sign?t=…`
  (`JobContractSign.tsx`, `sign-job-contract`, the PDF drawn with pdf-lib). A person or a company signs
  paperwork on **`/contract/accept?t=…`** (`ContractAccept.tsx`): `send-contract-for-signature` mints
  the token on a `person_contract_documents` row, `get-contract-for-signer` serves it, `accept-contract`
  fills and flattens the PDF (`_shared/fillFormPdf.ts`). A **Contract Form** is an authored PDF with
  dev-placed boxes, one box kind being `signature`; the sub's lien waivers are exactly this
  (`LienWaiverSendModal.tsx`, `docs/CONTRACT_FORMS.md`).
- **What a signed form keeps** on `person_contract_documents`: `signed_at`, `signer_printed_name`,
  `signer_signature_storage_path` (the ink, bucket `contract-signer-signatures`), `signer_ip`,
  `signer_user_agent`, `signer_consented_at` (`esign_consents`), `form_values`, `form_pdf_storage_path`
  (`contract-form-pdfs/<id>/signed.pdf`), `form_source` portal or paper, `form_scan_storage_path`.
  Opening the PDF goes through `open-contract-form-pdf` (dev, controller, a pay-approved master; a statement's
  copy for a dev and the controller alone since v2.6450) and is logged.
- **The capture**: `SignatureTypeOrDrawInput` (type a name or draw on a `signature_pad` canvas),
  `SignerNameInput`, `EsignConsentLine`; in person, the same page opens on the device in hand
  (`&inperson=1`, the contract modal's *Open the signing page on this device*, Job Mode's *Hand the
  phone to the customer*, `signer_mode = in_person`). The Lien Release window's signature
  (`docs/LIEN_RELEASE_MODAL_ARCHITECTURE.md`) adds the signing code for a master on someone else's
  screen; the statement does not need it, since the worker signs for themself.
- **The papers**: every print is its own HTML builder, opened with `openHtmlPrintWindow`
  (`src/lib/jobsDocuments/printWindow.ts`), wrapped `<html data-theme="light">` (`src/index.css`:
  `[data-theme='light']` re-pins its subtree light). The Costs packet (v2.5749,
  `src/lib/jobsDocuments/jobCostsPacket.ts`) is the model: `@page { size: letter; margin: 0.5in 0.5in
  0.6in }`, `.sheet { width: 8.5in; min-height: 11in }`, page-number footers, a stamp of when and by
  whom. The pay report (`buildPayStubHtml.ts`) is the look Taunya named. `JobContractPaper.tsx` is the
  editable in-window paper; `AiaG702G703Paper.tsx` is a preview whose output is a workbook. There is
  no HTML-to-PDF renderer: PDFs are pdf-lib on the server or jsPDF in the browser.
- **Where a copy is kept**: `sent_documents` (append-only, bucket `sent-documents`,
  `docs/SENT_COPIES.md`) lists under the job window's *Sent from this job*; the job's Drive folder
  (v2.6054, `job-drive-folders`) has *Team only / Sent by us*, written by `drive-link`'s `put`, which no
  app surface calls yet; a Legal matter's **Evidence** tab is `legal_matter_documents` (title, `shows`,
  `storage_path`, `state`, `sent_*`, bucket `legal-matter-documents`), PDF, image, .eml or text up to
  10 MB, written by `addLegalMatterDocument` and by dev-mcp's `plan_matter_document`.

### What counsel and the Legal desk want

- The memo (`docs/COUNSEL_MEMO_GC_ON_NOTICE_2026-09-22.md`) is about the notice and the collection
  path; it asks for nothing sworn about labor. It keeps the GC's envelope to *the form and invoices
  only*, asks the office to keep a grid per job (address, owner of record, last day on site, last month
  worked, unpaid months and dollars), and keys every deadline to the month labor was furnished.
- The lien affidavit (`lienFilingDocuments.ts`) swears the work's span and amounts; it is the only
  notarized paper. A suit on an account needs an itemized record (TRCP 185, the lien-rules guide).
- The Legal desk's Evidence tab draws **Proof the work happened**: per job, reports, approved clock
  sessions, hours, first to last day, photo and Drive links (`LegalDeskPacketTab.tsx`). The firm's
  packet letters its exhibits from the candidates in `legalPacket.ts` (invoices and payments, signed
  agreements, final demands, lien paper, the record of contact, field reports and clock sessions, the
  property record; office uploads come after as *Documents from the office*, `legalFirmPacketPrint.ts`).
  **No exhibit today is a labor, time or payroll record**, and no *Before this goes to an attorney* gap
  asks for proof that labor was paid. The desk opens for dev, master, assistant and controller.
- The nearest existing pattern is the **License hours log** (`list_user_license_hours_log`,
  `PersonLicenseHoursLogModal.tsx`, guide `license-hours-log`): approved sessions by job and week under a
  certification header, wages never shown, signed outside the app on the board's form.

### The gap Taunya names (counts only, read live on 2026-10-29)

The app's first punch is **2026-03-12**; the first `people_hours` row is 2026-02-01 (327 rows typed
by hand in February 2026 before any punch); the first sub sheet 2026-03-11; the first pay report the
week of 2026-03-01. **Every one of those tables is empty for all of 2025.** Of 880 jobs on the ledger,
544 were on it before the first punch and 650 have no last work day from an approved session.

| Month | Sessions | On a job | Approved | Salary | Office job | Quick adds | `people_hours` days | Sub sheets | Pay reports |
|---|---|---|---|---|---|---|---|---|---|
| 2025-01 … 2026-01 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-02 | 0 | 0 | 0 | 0 | 0 | 0 | 327 | 0 | 0 |
| 2026-03 | 247 | 134 | 227 | 2 | 56 | 0 | 301 | 9 | 39 |
| 2026-04 | 547 | 476 | 516 | 110 | 177 | 0 | 335 | 11 | 67 |
| 2026-05 | 435 | 373 | 416 | 96 | 137 | 0 | 252 | 17 | 68 |
| 2026-06 | 373 | 324 | 363 | 89 | 142 | 0 | 223 | 6 | 44 |
| 2026-07 | 376 | 343 | 363 | 65 | 135 | 0 | 228 | 16 | 47 |
| 2026-08 | 318 | 291 | 305 | 55 | 102 | 0 | 200 | 10 | 57 |
| 2026-09 | 269 | 264 | 256 | 53 | 86 | 1 | 184 | 12 | 41 |
| 2026-10 (to the 29th) | 234 | 234 | 216 | 47 | 96 | 8 | 167 | 4 | 30 |

So the span Taunya names (the second quarter of 2025 into 2026) is not thin in the app: it is absent.
March 2026 is thin in one way, 134 of 247 sessions on a job; from April on nearly every session names
its job. The tool therefore has two faces: for work since March 2026, a record the app made, with the
worker's signature under it; for anything earlier, the worker's declaration, which the paper must
never dress up as the company's record.

## The design (the mock-up beside this card)

1. **Where it opens.** The job window's **Documents** tab gets a section *Hours statements* beside the
   bills, the contract and the lien paper: every statement on the job with its state (signed, waiting,
   draft) and the press **Hours statement…**, its count from who clocked on the job. The person's desk
   (`/people?tab=person&id=…`) gets the same press under **Hours**, with the job picked instead of the
   person. The office job is a job, so it has no door of its own. The Legal desk's Evidence tab offers
   the statements per job on *Proof the work happened* (PR 4).
2. **The window.** Who (a person, or a sub's company), from and to, two switches: *Show the rate, the
   amount and what was paid* (on by default for whoever sees the window: a dev and the controller, since v2.6450)
   and *Add days the app did not record* (the stated block). A line says what the app has in the span
   (approved sessions, typed days, quick adds left off), and a held line names a session still waiting
   for approval, which the paper says under that day instead of counting. The preview is the paper.
   Presses: **Send for signature…**, **Print**, **Sign here now**, **Save a draft**.
3. **The paper.** Letter, light, in the pay report's manner. The company header; *Statement of hours
   worked and paid* (or *worked*); worker and their standing (employee, helper, subcontractor with the
   signer's name, assistant); job number and name, customer, **site address**; period; the approver.
   Then the table by week and day: day, in, out, hours, the session's note, and with the switch the rate and amount. No column says how a row was recorded
   (a punch, a typed day, a quick add, a schedule row, a sheet line): the owner took it off on 2026-10-29;
   the app keeps that and the window shows it, and the paper reads as one table. A total line: *Recorded in the app, this job*. Then **Paid**: per week, the
   job's share of the week's pay, the week's payments with the day, the amount and the reference
   (Cash App id, bank, memo), and one plain line that a week's pay covers every job that week; for a
   sub, the sheet's payments with their memo and the lien waiver already signed for each. Then the
   **stated** block where the switch is on: the span the company's records do not show, said in the
   company's words, and rows the worker fills. Then the attestation, the worker's signature with the
   day, the device and the printed name, the preparer's line, and a footer with the record id
   (`HS-<job>-<n>`) and *as of* the read.
4. **Three kinds of worker, one builder.** An employee's or helper's rows are sessions. A sub's rows
   are the sheet's lines, called *on the sheets*, never *clocked*, with the sheet's span as the days. A
   salaried person's days are the schedule's rows, the rate column left off. The office job's paper is
   the same paper with the office as the site, no customer, and the quick adds as ordinary rows.
5. **The signing.** The statement is minted as a **Contract Form**: a PDF drawn with pdf-lib (as
   `jobContractPdf.ts` draws the contract) and a per-statement form schema with the signature box, the
   date and the stated rows as text boxes, on a `person_contract_documents` row sent by
   `send-contract-for-signature` and signed on `/contract/accept` with the type-or-draw box, the consent
   line and the printed name; `accept-contract` flattens the typed days and the ink into `signed.pdf`,
   and the app also keeps the typed days as rows on the statement. Channels as the contract modal has
   them: text the link, email it, copy it, **Hand the phone to <name>** on the device in hand (recorded
   as in person with the office person's name). On paper: Print, sign with a pen, *File a signed scan…*
   (`form_source = paper`, the paper-entry path the Contract Forms already keep).
6. **Where the signed copy is filed.** Where the Contract Forms keep theirs
   (`contract-form-pdfs/<id>/signed.pdf`), listed on the job's Documents tab and on the person's
   desk under Paperwork as a document lineage, and on the matter's Evidence tab by one press, which
   copies the PDF into `legal_matter_documents` with a `shows` line and makes it a lettered exhibit,
   *Signed hours statements*, in the firm's packet (D · Field evidence). Never into the lien run's
   copies, by counsel's memo. Drive's *Team only / Sent by us* later, when `drive-link`'s `put` has a
   caller.
7. **Who may make one.** A dev and the controller, and no one else — Diane's call of 2026-11-02 (built
   v2.6450): the paper is payroll data. It revises the owner's call 6 of 2026-10-29, which had the payroll
   roles (dev, controller, a pay-approved master) make the paper with money and an assistant the hours-only
   paper; both go. The table holds the line (`can_touch_hours_statement` is a dev or the controller), the
   section shows to the two roles with *Controllers and devs only* beside its heading and to no one else,
   and a signed PDF opens through `open-contract-form-pdf` for the same two (a pay-approved master, who
   opens every other signed form, is refused on a statement's row).
8. **Through the MCP** (the owner's ask of 2026-10-29). Two verbs on the dev MCP (`docs/dev-mcp/README.md`),
   as the dev whose key it is, with RLS and the role lines above. **`get_hours_statement(job, person, from,
   to, with_pay?)`** is a read composite: the same reads the window makes, handed to the same kernel, so
   the answer is the paper's rows, weeks, pay lines, gap spans and totals, with a one-line `reading`
   first (*118.5 h on 23 days, 4 weeks paid in full; nothing in the app before 2026-03-12*) and the
   statements already made for that job and person with their state; `view_as` runs it as a role.
   **`plan_hours_statement(statement)` → `apply_hours_statement(statement, plan_hash)`** makes one the way
   the window does, through a dev-gated dry-run wrapper `dev_hours_statement_write` over the same writes
   (the row, the PDF, the Contract Form), the dev named as the preparer whatever the payload says:
   `{ action: 'make', job, person, from, to, with_pay, stated_days?, send: { how: 'email' | 'link' } }`
   sends the signing link or hands it back (redacted in the log), and `{ action: 'file_on_matter', statement,
   matter_id }` copies a signed PDF onto a matter's Evidence tab as the desk does. Plan first, read the
   plan, apply quoting its hash; the apply re-runs the dry run and writes only when it still matches.

## The owner's calls (decided 2026-10-29)

Taunya took all seven as recommended: *"Yes, as recommended."* Column A is what was picked, B what was
not.

| | A (picked) | B (not) | Decided |
|---|---|---|---|
| **1 · The signer's channel** | A text or an email with the link, and a phone in hand | In person only, on the office's phone | **A.** The contract's four channels exist; the paper decides nothing about how it is signed. |
| **2 · Rate and amount, or hours alone** | Hours, the rate, the amount and the payments, with a switch to leave the money off | Hours alone, always | **A.** The ask is proof the company paid; a paper that cannot say what was paid proves half. The switch keeps an hours-only copy for a GC or a license board, and lets an assistant make one. |
| **3 · Is a payment line required?** | No: an unpaid week prints *not yet paid* and the attestation drops *paid as shown* | Yes: the paper refuses until every week is paid | **A.** A signature soon after the work is worth more than waiting for the pay; the paper never claims a payment it does not have. |
| **4 · The office job's paper** | The same paper: the office as the site, no customer, the quick adds as ordinary rows | A separate overhead paper | **A.** One builder, one window; the office job is a job. |
| **5 · A period with no rows** | A *days the company's records do not show* block the worker fills in, marked stated, the span said plainly | Only what the app recorded; a gap paper reads *no record* and stops | **A**, with counsel's word on its weight first: nothing in the app precedes 2026-03-12, so for 2025 the paper is the worker's declaration and nothing else. A paper that only says *no record* is honest and useless. The office may pre-fill the block from outside records (texts, bank sends) with the source named on each row. |
| **6 · Who may make one** | The payroll roles for the paper with money; assistants the hours-only paper | Devs and the owner only | **A** on 2026-10-29, matching the Hours and Payroll tabs' lines; **revised by Diane on 2026-11-02 to a dev and the controller alone** (built v2.6450), since the paper is payroll data — nearer B than A, with the controller in. |
| **7 · Where the signed copy goes** | The job's Documents tab and the person's Paperwork at once; the matter's Evidence tab by one press; Drive later | Drive only | **A.** The matter is where court starts, and the desk already has the per-job proof table. |

## Where it plugs in

- **Exists**: `clock_sessions`, `people_hours`, `people_crew_jobs`, `clock_typed_entries`,
  `pay_stubs`, `pay_stub_days`, `pay_stub_payments`, `people_labor_jobs` + items + assignees +
  payments, `people_pay_config`; `list_user_license_hours_log`, `fetchTeamLaborBreakdownForJob`,
  `jobHoursStory.ts`; `buildPayStubHtml.ts`, `jobCostsPacket.ts` (the page rule), `printWindow.ts`;
  `person_contract_documents`, `send-contract-for-signature`, `get-contract-for-signer`,
  `accept-contract`, `_shared/fillFormPdf.ts`, `_shared/formSchema.ts`, `open-contract-form-pdf`,
  `contract-form-paper-entry`; `ContractAccept.tsx`, `SignatureTypeOrDrawInput`, `EsignConsentLine`,
  `esign_consents`; `JobWindowDocumentsTab.tsx`, `PersonDeskHoursSection.tsx`,
  `PersonDeskPaperworkSection.tsx`; `LegalMatterDocumentsPanel.tsx`, `legalMatterDocumentsIo.ts`,
  `legalPacket.ts` (the exhibit candidates), `LegalDeskPacketTab.tsx` (*Proof the work happened*);
  `readOverheadOfficeJobLedgerId`; the dev MCP's door and composites (`supabase/functions/_shared/devMcpDoor.ts`,
  `_shared/devMcpComposites.ts` against an injected `Reader`, tests in `src/lib/devMcp/`), its generated
  catalog (`dev-mcp/catalog.ts`, `scripts/build-dev-mcp-catalog.mjs`), the plan → apply pattern of
  `plan_matter_document`, and the route in `scripts/cloudflare/mcp-router.worker.js`.
- **New**: a pure kernel `src/lib/people/hoursStatement.ts` (rows from sessions or sheet lines, the
  week groups, the pay lines per week from the stubs and their payments, the stated block, the gap
  spans, the attestation words by switch) with `buildHoursStatementHtml`; a table
  `hours_statements` (`id`, `record_id`, `job_ledger_id`, `person_id`, `user_id`, `labor_company`,
  `period_start`, `period_end`, `with_pay`, `kind` clock · sheet · schedule, `stated_days` jsonb,
  `gap_from`, `gap_to`, `snapshot` jsonb of the rows as read, `prepared_by`, `prepared_at`,
  `contract_document_id` → `person_contract_documents`, `matter_document_id` →
  `legal_matter_documents`), with the three block calls and RLS for a dev and the controller alone (v2.6450; the payroll roles and assistants until then);
  a `record_type` value `hours_statement` on `esign_consents`; a statement PDF drawn with pdf-lib
  (`_shared/hoursStatementPdf.ts`) and its form schema; a `link` and in-person mode on
  `send-contract-for-signature` (the job-contract side has them, the person side only email);
  the exhibit candidate *Signed hours statements*; the composite `get_hours_statement`, the wrapper RPC
  `dev_hours_statement_write` and the verbs `plan_hours_statement` / `apply_hours_statement` with their
  rows in `docs/dev-mcp/README.md` and `docs/EDGE_FUNCTIONS.md` → dev-mcp; guide *make a signed hours
  statement*.

## The plan

1. **PR 1 · the kernel and the print (S).** The kernel in `supabase/functions/_shared/hoursStatement.ts`,
   re-exported by `src/lib/people/hoursStatement.ts` (as `whereFilesGo.ts` is, v2.6056), so the window and
   the MCP read one kernel; with tests: a helper's clock rows, a
   sub's sheet lines, a salaried person's schedule rows, a week with a pending session, a week unpaid,
   a span with no rows, the office job; `buildHoursStatementHtml` beside the pay report's, Letter,
   light, the Costs packet's page rule. A dev-only press on the job window's Documents tab to print one.
2. **PR 2 · the window and the table (M).** The migration (`hours_statements`, the consent kind),
   the window on the job's Documents tab and the person's Hours section, the two switches, the held
   line, Print, Save a draft, the Hours statements section; guide; `docs/PROJECT_DOCUMENTATION.md`,
   `GLOSSARY.md`, `ACCESS_CONTROL.md`, `docs/twins/APP_DIRECTORY.md`.
3. **PR 3 · the signing (M).** The pdf-lib statement and its form schema, the `person_contract_documents`
   row, **Send for signature…** with the four channels and **Hand the phone to <name>**, the stated rows
   as form boxes, the signed PDF listed on the job and the person; the paper path with *File a signed
   scan…*; `docs/EDGE_FUNCTIONS.md` for the changed functions, `docs/CONTRACT_FORMS.md`.
4. **PR 4 · the matter (S).** *Signed statements* on the Evidence tab's proof table with **Ask…** per
   worker, **Add to evidence** copying the PDF into `legal_matter_documents`, the exhibit candidate and
   its lettering, the gap jobs read as gap jobs. Drive's *Sent by us* when `drive-link`'s `put` has a
   caller, as a later S.
5. **PR 5 · the MCP (S).** `get_hours_statement` as a composite over the shared kernel; the migration
   for `dev_hours_statement_write`; `plan_hours_statement` / `apply_hours_statement`; the catalog rebuilt,
   `dev-mcp` redeployed, its version bumped; the verbs' rows in the two docs; a test under
   `src/lib/devMcp/` with the fake reader. The signing link never appears in the call log.

## How to verify

Dev server, `/dev-login?as=1`. Open a test job's window (972 is the owner's) → Documents → **Hours
statement…**; pick a person with sessions on it and a span; read the preview against People → Hours
for the same days; flip the money switch and read the rate against the pay report for that week and
the payment against Payroll → Pay run; set the span to start in 2025 and read the stated block and the
gap line; Print and check the Letter page in light while the app is dark. Send for signature to a ZZ
test contact's email, sign on a phone with the type and the draw boxes and two typed days, open the
signed PDF through the gate, find the row on the job's Documents tab and the person's Paperwork. On a
test matter, press Add to evidence and read the exhibit letter in What goes to the firm. Repeat for a
sub's sheet and for the Office job. Screenshots at 375, 768 and 1,280, light and dark. Real names,
jobs and amounts stay out of the repo and the mock-up.

## Not verified

- The prod reads were counts only, through the signed-in dev's own client; no row was opened. The
  dev MCP key was revoked on this machine, so nothing was read through it.
- Whether `send-contract-for-signature` can mint a link without an email was read, not run: the
  function takes `signer_email`; the link and in-person modes are a change to it.
- Counsel has not been asked what a worker's after-the-fact statement for 2025 is worth beside the
  pay records the company already has (bank and Cash App sends). Call 5 waits on that. PR 3 shipped the stated
  block anyway on Diane's call of 2026-11-02: the paper, the form's boxes and the row all mark those days as the
  worker's own statement, never the company's record, so counsel's answer changes the words, not the shape.
- In passing: `src/lib/jobs/lienNoticeDraft.ts` sets the affidavit's work span to one day
  (`workStart` and `workEnd` both the month's end), so ¶5 of the affidavit swears a single day, not
  the span. Not part of this card; a fix of its own.

## Where it stands

2026-11-08, the walk, in the owner's Chrome on a ZZ Test project job with a test sub's one sheet (9 h at $100):
**Hours statement…** on the job's Documents tab read *1 person here, 1 on the sheets* and opened on the sub with the
sheet's line, the charged switch held and *as paid* words; **Company** typed made the attestation read *I, <sub>, for
<company>, state…* and the signature line *for <company>*; **Sign here now** saved the draft as HS-1113-0001, opened
the in-person signing page in a new tab and, since the browser blocked the window, showed the link in a dialog with *I
opened it*; the form signed with a typed name and two ticks, the row read Signed with **Open the signed PDF**, **Put in
Sent by us** copied the PDF into Team only → Sent by us (the row then **Open in Drive ↗**, `drive_file_id` set), and the
dev MCP's `get_hours_statement` with `kind: sheet` read the same 9 h, $900 and attestation and listed HS-1113-0001 as
signed. Two things did not finish: **Open the signed PDF** sent the gate its request but drew no tab (the popup after the
fetch was blocked and nothing fell back, unlike Sign here now); and the Legal desk lists only collections accounts, so
the band was read on a real account — *Ask <sub> (<company>)… on the sheets* under its job, as v2.6660 draws it — and
never pressed. The ZZ Test rows (the job, its sheet and statement) stay for the owner to look at: the job refused
deletion with *This job has costs attached* while every listed cost read $0.00.

Explored 2026-10-29 in its own session; the owner read the card and the mock-up the same day, took the Record
column off the paper, took all seven calls as recommended and asked for the statement through the MCP. PR 1
shipped the same day as v2.6069: the kernel in `supabase/functions/_shared/hoursStatement.ts` (re-exported by
`src/lib/people/hoursStatement.ts`) with its eleven cases, `buildHoursStatementHtml` beside the pay report's
builder, the reads in `src/lib/people/hoursStatementRead.ts`, and a dev-only press on the job window's
Documents tab that printed one from live rows. PR 2 shipped the same day as v2.6097: the `hours_statements` table
with its gate (`can_touch_hours_statement`, migration `20261030030000`, pushed from the main checkout after the
merge), the record id's kernel `hoursStatementRecord.ts` beside the statement's, the window `HoursStatementModal.tsx`
with its two switches, the span line, the held line and the paper as the preview, **Save a draft** and **Print** (which
saves, stamps the id and files nothing), **Send for signature…** and **Sign here now** drawn and held, and the
**Hours statements** section on the job's Documents tab and under the desk's Hours & approvals; the dev press is gone.
The print was restyled on 2026-11-02 as v2.6412 after the first real quarter printed as five pages with the table
squeezed into the right half (one unclosed `<div>` in the facts block): the facts as one band across the width, the
table full width with one line per day and *In – Out* as one cell, the rate stated once when it is the same all
period, hours to two decimals, the week's subtotals under Hours and Amount, a long note on its own line under its
day, Paid and the signatures as full-width bands, the column header on every page and no row split; a quarter is
three pages. The mock-up it was built from is `mockup-print-v2.html` beside this card. PR 3's pdf-lib paper was drawn
before the restyle landed and keeps the earlier table (In and Out as two columns, the rate on every row); bringing
it to the full-width layout is a residual below.
PR 3 shipped 2026-11-02 as v2.6411: the statement is its own Contract Form — `_shared/hoursStatementPdf.ts` draws the
paper with pdf-lib and records the schema as it draws (the stated rows as boxes, three blank after the office's, the
printed name, the signature, the date), `_shared/hoursStatementForm.ts` names the document, the keys, the seeds and the
days read back; `hours-statement-signing` (`prepare`, `file_scan`) writes one `contract_form_templates` row and one
`person_contract_documents` copy per statement (`doc_type` `hours_statement`, migration `20261102230000`) and ties the
row to it; `send-contract-for-signature` gained `mode: 'link'`; `accept-contract` marks the statement signed with the
typed days and keeps the consent as `hours_statement`; `open-contract-form-pdf` let an assistant open an hours-only
one until v2.6450 took the assistant and the pay-approved master off the paper altogether (Diane's call of 2026-11-02: payroll data). The window's **Send for signature…** opens the channel sheet (Email the link · Text the link · Copy the link ·
Hand the phone to <name>), **Sign here now** is the last in one press, **File a signed scan…** the paper path, and a
signed row carries **Open the signed PDF** on the list and the window. Counsel's word on the stated block is still owed;
the block shipped marked as the worker's own statement. PR 4 shipped 2026-11-03 as v2.6413: the packet reads the
`hours_statements` on the account's jobs and the app's first clock day, each `LegalEvidenceJob` carries its statements,
its workers and whether it is a gap job, `LegalEvidenceStatementsBand.tsx` sits under each job of *Proof the work
happened* with **Ask <name>…** (the window on the job with the worker picked), **Add to evidence** (the signed PDF
copied onto the matter through `hoursStatementEvidence.ts`, `matter_document_id` filled, the copy taken off again if the
tie fails) and **Show on Evidence ↗**, the exhibit *Signed hours statements* letters under D on the desk and in the
firm's print, and a gap job says a statement there would be the worker's own and asks no one. Drive's *Sent by us*
stays the later S. PR 5 shipped 2026-11-03 as v2.6414: `get_hours_statement` as a composite over the door as the
reader (`_shared/devMcpHoursStatement.ts`, the window's reads handed to the shared kernel, a reading line first, the
statements made last), `plan_hours_statement` → `apply_hours_statement` over `dev_hours_statement_write` (migration
`20261103003000`: `make` the row the window saves from the snapshot the server read, the record id minted in SQL, the
dev as preparer; `send` the window's two calls as the dev with the link in the reply and never in the log; `file_on_matter`
the signed PDF onto a matter through the document wrapper), the server at 0.20.0, the catalog rebuilt. The train is
built. What is left: the owner's look at the five PRs live; counsel's word on the stated block's weight; Drive's *Sent
by us* when `drive-link`'s `put` has a caller; a sub's sheet lines through the window (the kernel's `sheet` kind has no
reader yet, so a sub's paper is still made by hand).

## The walk of 2026-11-07

The owner, asked for his look at the five PRs live, said they are not walked yet and to build on; the look stays owed on the whole once the residuals land. On counsel's word he said we move on without it — if counsel sees something later he will make a note — so the stated block stays marked as the worker's own statement and the blocker is lifted. He picked all four residuals: the signed PDF to the print's layout and the charged basis (v2.6629, this session), the Legal desk band's words for a role that cannot read statements, Drive's *Sent by us* copy of the signed PDF, and a sub's sheet lines through the window. The dev MCP's charged paper (the review's fourth finding) is not picked yet and stays here.

## The residuals of 2026-11-07

Four PRs, each from main with its own fragment: v2.6629 (#7201) the signed PDF redrawn to the print's full-width layout and the charged basis, the shape's helpers moved into the shared kernel so the two drawers cannot disagree; v2.6633 (#7202) the Evidence tab's Signed statements line says *Only a dev or the controller can read the signed statements here* to a role the policy answers nothing; v2.6634 (#7210) **Put in Sent by us** on a signed row — the signed PDF through its gate into the job's *Team only → Sent by us* through `drive-link`'s `put`, the Drive file id on the row (`drive_file_id`, migration `20261107130000`), **Open in Drive ↗** after; v2.6636 (#7214) a sub on the job's sheets in the window's Who list by their sheets, the paper reading the sheets' lines through `hoursStatementSheets.ts`, always as paid, the words naming the sheets. What stayed open after them — the dev MCP's charged and sheet papers, the Legal desk's **Ask <name>…** for a sub, the company on a sub's attestation — the owner picked the same day (*"just do it, I would prefer you do it"*) and three more PRs built, each from main: v2.6654 (#7246) `get_hours_statement` / `plan_hours_statement` take `basis` (the charged paper priced by the window's own kernel, `hoursStatementCharged.ts`, lifted out of the read and mirrored to the edge with `lib/charges/*`) and `kind` (a sub's sheets through `hoursStatementSheets.ts`, always as paid), `dev_hours_statement_write` replaced by migration `20261107170000` to take `basis`, `charge_rate`, `charge_words` and `labor_company`, the server at 0.39.0; v2.6660 (#7249) the Evidence tab's band lists every sub on the job's sheets with a login as **Ask <name>… on the sheets** (the packet's `sheetSubs`, a worker's `kind`), a job with a sheet no gap job; v2.6661 (this close-out) the window's **Company** field on a sheet paper, kept as `labor_company` and in the snapshot's worker so the attestation, the facts band and the signature line name it on the print and the signed PDF, and `labor_company` on the seat's `make`. Pushed and deployed the same day after the merges: `supabase db push` applied 20261107170000 (with #210's 20261107160000 riding along), `npm run check:migration-drift` read 1153 of 1153 applied, and `dev-mcp` went out at 0.39.0; the live seat read a charged paper on a ZZ test job, the rate card's $285.00 the crew's hour and no pay reads. Nothing of the card is left to build: the owner's live look at the whole is the one step left, and the card stays until he has had it. Counsel's note, if one comes, changes the stated block's words.

## Found in review, 2026-11-04

The signed PDF (`supabase/functions/_shared/hoursStatementPdf.ts`) follows neither v2.6412's full-width layout (its title is only worked / worked and paid, a two-column facts grid, separate In and Out columns, a Rate column whenever there is pay) nor the charged basis (no `basis` handling), yet `HoursStatementModal`'s `canSign` offers Send for signature, Sign here now and File a signed scan on a charged row, so a charged statement sent for signature is drawn as *Statement of hours worked* with no Charged band and the signed copy disagrees with the printed charged paper. The Legal desk's `LegalEvidenceStatementsBand` draws *Nothing signed here yet* for a role that cannot read statements even when signed ones exist. The dev MCP's `get_hours_statement` and `plan_hours_statement` make only the paid paper.
