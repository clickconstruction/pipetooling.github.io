# Test reports — the hydrostatic / gas report and its email, inside PipeTooling

Status: **not started** · proposal awaiting owner pick · designed 2026-09-11 · mock-up [`mockup.html`](./mockup.html) (four panels: the flow today vs proposed, the Test report modal, the Send sheet, the automation dial + PDF)

Replaces the external report app at plumbingtooling.com (repo `clickconstruction/plumbingtooling.github.io`, renamed from `clicktooling.github.io` on 2026-09-11; ~2,900 lines of vanilla JS + Bootstrap, no backend). The Stages door to it is `buildClickToolingUrl` in `src/lib/jobs/jobAddressUrls.ts`.

## The ask, in the owner's words

"Long term I would like for us to work to internalize the app and I think this means we need to rebuild it in our code rather than its current code."

Then, with the sent email open: "Right now the final result of that app is an assistant putting a Stripe invoice titled (but not shared to a customer) and the test report she creates into an email to the GC Done Right Foundation and attaches the report. I think this is a process we should internalize so that we can automate these reports."

## What happens today (traced 2026-09-11 from the Sept 1 "Johnson Test" email)

1. The tech runs the test on a pretest job (J1012 Scarbrough Pretest, J1013 Peterson Pretest, J1014 Johnson Pretest are all on this week's board) and leaves a clock-out field report: "100 · Hydrostatic - passed". That report carries the result but none of the test data.
2. Back at the office, Taunya opens the Stages row → **Plumbing Tooling report**. The link carries name / email / phone / address; she picks Pre-Test → Sewer, the date, PASS, types notes, clicks Report → Download PDF. The PDF is an html2canvas screenshot in a jsPDF page (raster, not text, one page max) and lands in a browser tab. The certification block (Malachi Whites, #RMP41130, office and TSBPE addresses) is a string literal in the app.
3. She opens Bill Customer on the same job → Stripe channel → **Create Stripe invoice**. `create-stripe-invoice` finalizes but never emails (`docs/BILLING_FLOWS.md` → Stripe bill); she copies the hosted pay link from the post-create panel.
4. In Gmail she writes to the GC (Done Right Foundation Repair, the payer on these jobs), cc Malachi: "Attached is the report for 112 Seidel St, Marion, TX 78124 and below is the invoice link", pastes the link, attaches the PDF.

Four surfaces, the customer details typed or pasted three times, and the only trace in PipeTooling is the invoice row. The report itself exists nowhere we can find it later. The external app also has an invoice generator (fixed $250, the GC's name hard-coded in the template) that duplicates Bill Customer — it dies with the app.

## The decision (proposed — owner picks the automation level)

A **Test report** is a job-level document PipeTooling writes, stores and sends. One action from the job replaces steps 2–4: the report is prefilled from the job, rendered as a real-text PDF on the company letterhead, and **Send** emails it to the GC contact with the job's Stripe pay link in the body, cc'd per the customer's rule, and logged on the job. Billing stays exactly where it is (Bill Customer → Stripe); the report flow *reads* the hosted link, it never creates invoices.

Automation is a dial, set per company and overridable per customer:

- **A · Office sends (recommended first).** The tech's clock-out report drafts the Test report (type from the job name / template, result from the report, date and duration from the clock session). The Dashboard's Needs You list shows *N test reports ready to send*; the office opens each, glances, clicks Send. The Stripe bill is a prerequisite the sheet points at ("Bill first") when missing.
- **B · Auto-send when complete.** When the draft is complete *and* the job has a Stripe bill, PipeTooling sends without a human click and posts "Sent to Done Right · report + invoice" on the job's activity. The office gets the Needs You line only for blocked ones (no GC email, no bill, FAIL results — a fail should always be read by a person before it goes out).
- **C · The tech sends from the field.** The clock-out report *is* the Test report form (pass/fail, notes, gas fixtures) and the tech's Send goes straight to the GC. Fastest, but puts the customer-facing document in the field crew's hands.

Recommendation: ship A, run it for a month, flip the dial to B for pass results on customers with a standing Stripe channel. C stays a per-customer option.

## What the external app does that we keep, and what we drop

| Keep (becomes the kernel) | Drop |
|---|---|
| Four test types: Pre-Test / Post-Test (Supply · Sewer), Pinpoint, Gas | The invoice generator (Bill Customer already does this) |
| Pass / fail with canned conclusions per system; the pinpoint findings text; the gas pressure conversions (PSI ↔ in WC ↔ oz/in² ↔ mm WC, PSI base: ×27.68 / ×16 / ×703) and the fixture BTU/hr list with total | localStorage customer memory and the quick-fill paste parser (the job already knows the customer) |
| The report layout: title "Sewer Pre-Test Hydrostatic Test Report", customer + location columns, test details, results, certification | html2canvas raster PDFs (real text via jsPDF, the hazmat-notice block pattern) |
| The "Preleveling / Postleveling Hydrostatic Test at <address>" service description (useful as the Stripe line item memo) | Hard-coded certifier and addresses (settings + the licensed person) |
| The pinpoint share-URL idea (office pre-fills findings for the tech) | The URL itself — it becomes Send-as-task with the draft attached |

## The flow (proposed)

```
tech clocks out ──► field report "Hydrostatic · pass" ──► draft Test report on the job
                                                              │
office: Bill Customer → Stripe (unchanged) ◄──────────────────┤ "Bill first" nudge if no bill
                                                              ▼
                 Needs You: "3 test reports ready to send" ──► Test report modal (prefilled)
                                                              │  review · PDF preview
                                                              ▼
                                        Send sheet: To GC contact · cc rule · pay link · PDF
                                                              │
                                    edge fn sends (Resend) ──► job activity + dispatch log
                                                              │
                                                 customer portal: Test reports section (optional)
```

Dial B removes the two human clicks in the middle for pass results; dial C moves the whole middle onto the clock-out screen.

## Where it plugs in

**Exists**

- Door: `buildClickToolingUrl` (`src/lib/jobs/jobAddressUrls.ts`) used by `JobsStagesTable.tsx:470`, `JobsStagesUnifiedTable.tsx:763,1172`, `JobsStagesCardList.tsx:653,901` ("Plumbing Tooling report"). Help guides that name it: `search-the-stages-board.md`, `ready-to-bill-pipeline.md`.
- Field reports: `reports` / `report_templates` / `report_template_fields` (flat label + `input_type` fields; signature, percent, stage-progress fields; `NewReportModal.tsx`; `send-report-email` fans them out to `report_email_subscriptions`). The clock-out report is the draft's trigger, not its home — test data is typed (result, system, gas fixtures) and needs its own table.
- Stripe: `jobs_ledger_invoices.hosted_invoice_url` / `external_send_channel='stripe'` / `stripe_mode` (`SendRecordInvoiceModal.tsx`, `HostedStripeBillPanel.tsx`, `stripeInvoiceShareCopy.ts` — the mailto-only draft copy this replaces).
- PDF: `loadJsPDF.ts` (dynamic import), `jobsDocuments/hazmatFeeNoticePdf.ts` (pure block model → renderer with paging; the pattern), `physicalInvoicePdf.ts`.
- Company identity: `physicalInvoiceIssuer.ts` (app_settings; company, address, phone, license line). Person licenses: `PersonLicenseHoursLogModal.tsx` (TSBPE / TDLR) — the certifier's license number lives on the person.
- Email with attachments: `send-physical-invoice-email` (Resend, base64 PDF attachments, size guard) — the send function is a sibling of it. Letterhead email builders in `supabase/functions/_shared/` (estimate, contract signing) — reuse the brand block.
- GC on the job: `jobs_ledger.gc_customer_id` (embedded GC since v2.1176); the payer key `gc_customer_id ?? customer_id` (Their Word train). Customer contacts: `customer_contacts` is a *contact log* (date, method, details), not a people list — the GC's email is `customers.email`; a per-customer "reports go to" address may be a new column.
- Needs You: `dashboardNeedsYou.ts` (`buildNeedsYouItems`, `NEEDS_YOU_RANK`); portal: `customer-portal` fn + `src/components/portal/`.

**New**

- Kernel `src/lib/jobs/testReport.ts` (+ tests): types, `formatTestType`, system-tested / conclusion defaults, gas conversions and BTU totals, title + Stripe-memo derivation, draft-from-field-report, completeness (`sendBlockers`).
- Kernel `src/lib/jobsDocuments/testReportPdf.ts` (+ tests): block model → jsPDF, letterhead from the issuer settings, certifier block from the person.
- Table `job_test_reports` (job_id FK, `test_type` CHECK, `system` CHECK NULL/supply/sewer, `result` CHECK NULL/pass/fail, `test_date`, `duration_min`, `notes`, `pinpoint_*`, `gas_pressure_psi`, `gas_fixtures jsonb`, `certified_by_person_id`, `source_report_id` (the clock-out report), `pdf_path`, `sent_at`, `sent_to`, `sent_by`, `stripe_invoice_id`, `created_by`, timestamps) + RLS (office roles write, techs write their own drafts, subs never) + both read-only blocks. Storage bucket `job-test-reports` (private; signed URLs for the portal).
- Settings: `app_settings` keys for the certification texts per test type, the default certifier person, the automation dial; `customers.test_report_send_mode` (inherit / office / auto / tech) and `customers.test_report_cc`.
- Edge fn `send-test-report` (build PDF server-side from the same block model, or accept the client PDF like the physical invoice does; Resend; writes `sent_*`; posts the job activity line).
- Trigger / small RPC `draft_test_report_from_field_report` (dial A/B): on `reports` insert where the template is the hydrostatic one, upsert a draft.

## The plan (six PRs; each live before the next)

1. **Kernel + PDF, no UI.** `testReport.ts`, `testReportPdf.ts`, tests; a dev-only "Preview PDF" on Settings → What customers see (sample job) so the layout gets eyes before the table exists.
2. **Table + modal.** Migration, types regen, `TestReportModal` opened from the same Stages door (the external link stays in the modal footer as "Open in Plumbing Tooling" for one release), Job Detail "Test reports" section, help guide `file-a-test-report.md`.
3. **Send.** `send-test-report` fn, the Send sheet (To / cc / subject / body with the pay link / attachment; "Bill first" nudge), activity line, `sent_*` columns; Dashboard Needs You line *N test reports ready to send*.
4. **Draft from the field.** The clock-out report → draft trigger; test type inferred from the job name / template; the tech's pass/fail and notes flow in. Dial A live.
5. **Dial B + portal.** Auto-send rule (pass only, Stripe bill present, GC email present), per-customer override, portal section with signed PDF links.
6. **Retire.** Remove the external door and its help-guide mentions; plumbingtooling.com stays up until the last month shows zero visits, then archive the repo (`docs/DOMAIN_CUTOVER.md` note).

## How to verify

- Dev server on any port; dev-login `…/dev-login?as=1&to=%2Fjobs`; the Stages board's pretest jobs this week (J1012–J1014) are real — **do not send from them**. Use a ZZ test job with a ZZ test customer whose email is a team inbox.
- Stripe in **test mode** for the bill (`docs/BILLING_FLOWS.md` → live-test safety brief); the pay link in the sent email must be the test-mode hosted URL.
- PDF: open the attachment, select text (must be real text), check the certification block matches the person's license record, check a FAIL and a gas report with three fixtures paginate.
- Dial A: file a clock-out report on the ZZ job → the Needs You line increments → Send → activity line appears → `job_test_reports.sent_at` set, `report_email_dispatch_log`-style row present.
- Gotchas expected: `openInExternalBrowser` is what the door uses today (PWA); the modal replaces it, no new-tab dance. Portal signed URLs need the bucket policy that `estimate-acceptor-signatures` uses.

## Open questions for the owner

1. Who certifies — always the default master (Malachi today), or the licensed tech who ran the test when they hold an RMP/journeyman number?
2. Should filing the Test report also satisfy the clock-out field report, so the tech files once (dial C), or stay two steps (A/B)?
3. FAIL results: always a human Send, even on dial B? (Proposed: yes.)
4. Does the GC get the pay link in the same email (today's practice), or does the report go alone and billing keeps its own send? (Proposed: same email, matching what Taunya does.)
5. Portal visibility of test reports: yes for the payer only, or off until asked?
