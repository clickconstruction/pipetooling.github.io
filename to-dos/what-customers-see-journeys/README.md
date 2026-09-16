---
name: What customers see, completed → the customer's journey
group: ready
status: >
  in progress · proposed 2026-09-16 · Grace: "build it carefully and robustly" · PR 1 (v2.3505),
  PR 7 (v2.3507), PR 8 (v2.3508), the paper (v2.3509, PRs 3+5), the agreement (v2.3510, PR 2) and
  the GC's rooms (v2.3511, PR 4) built and stacked · PRs 6 and 9 remain · seven decisions taken as
  proposed
summary: >
  **What customers see, completed and turned into the customer's journey**: six public pages and
  two audiences (the supply house, the collections law firm) had no step on the tab, and nothing
  checked. PR 1 puts every surface on it as a *Next release* card behind a registry + CI test that
  fails when a public route or a customer email has no place; PR 7 opens the tab to the office
  with teaching on each card; PR 8 puts a **real person on the strips** — what was sent, opened,
  signed, paid, each card the link they hold and the app's next action, also as *Their journey*
  on the Customer page; then the sample fixtures per audience; last a health row of people per
  step and stalls per step. Mock-up in the folder with the data map for every surface's stamps.
next: >
  PR 1 the honest tab and PR 7 open to the office (in the queue); PR 8 a person on the strips
  (building); PRs 2–6 the sample fixtures by audience; PR 9 the health row.
size: L (9 PRs, each alone useful)
blocker: >
  None. Seven decisions taken as proposed; the owner may reverse any.
ver: in progress 09-16
---

# What customers see — every outside surface, then a real person's journey


## The ask, in the owner's words

Grace, 2026-09-16, after the gap list: *"Can you help me add those to the settings, what customers see section?"* Then, on the first mock-up: *"is this the best we can do? we now have everything in one place and have a unique opportunity to help the user understand parts of the customer journey and give them swift access to these portals."*

## Findings — what the code and the data already say

- **Settings → What customers see** (v2.2758 / v2.2760, owner pick B "Journeys") renders three audiences as strips of steps — Homeowner, General contractor, Subcontractor — each step a live iframe of the real public page with a sample token, or the real email builder run in the browser. Dev-only: `settingsGroups.ts` lists the tab for `dev`, and `Settings.tsx` renders it only for `myRole === 'dev'`.
- **Six public pages and two audiences had no step** when this started: `/contract/sign` (the customer's own service agreement — the tab's "Contract to sign" is the *sub's* contract at `/contract/accept`), `/submittal` (v2.3487), `/legal` (the collections law firm), `/q/:token` (the supply house), `/hazmat-notice`, `/estimate/terms`. Plus the emails outsiders get that the tab did not build: the agreement email and reminder, the test report email, GC statements, the bill by email, the demand letter and the § 53.056 notice, the firm's confirm / now / digest emails, the RFQ and job-account emails to a supply house.
- **Nothing told the tab it was behind.** Every one of those shipped with a fragment and a help guide; no gate asked "is it on What customers see?". Same failure mode as the smoke suite's stale labels (v2.3489).
- **The app already has an outbound-email catalog** — `src/lib/emailCatalog.ts` (v2.2656), one row per email with `audience` and `sender`. PR 1's registry cross-checks it: every `audience: 'customer'` row's sender must be placed on a journey.
- **Sample mode is anon-reachable by design** (v2.2763): the public page calls its function with the anon key and a `sample` / `sample-done` / `sample-gc` token; the function answers with a fixture from `_shared/customerSampleFixtures.ts` laid over the live Settings. Nothing in a fixture exists in the database; writes short-circuit.
- **The app records the whole journey and shows it nowhere together** (survey 2026-09-16, read-only). Per surface, where the stamps live:

  | Surface | Row | Sent | Opened / viewed | Signed / done | The link they hold |
  |---|---|---|---|---|---|
  | Estimate | `estimates` (`customer_id`) | `sent_at` | `estimate_customer_events` (`public_link_view`, `option_viewed`); kernel `estimateOpenState.ts` | `status`, `acceptor_*` | `/estimate/accept?t=` — **hash only** (`public_token_hash`); raw shown once after a resend |
  | Job contract | `job_contracts` (`job_id` → `jobs_ledger.customer_id`/`gc_customer_id`) | `sent_at`, `last_sent_at`, `send_count`, `reminder_count` | `first_viewed_at`, `last_viewed_at`, `view_count`, `job_contract_events` | `signed_at`, `signer_mode`, `paper_upload_path`, `voided_at` | `/contract/sign?t=` — raw `public_token` |
  | Stripe bill | `jobs_ledger_invoices` | `sent_to_customer_at`, `jobs_ledger_invoice_stripe_email_sends` | none | `stripe_invoice_status = paid` → `jobs_ledger_payments` | `hosted_invoice_url` |
  | Bill by email | same row | `external_send_channel = physical`, `sent_to_customer_at`; resends only in `email_send_log` | none | — | the PDF |
  | Hazmat notice | `job_hazmat_incidents` | `notice_emailed_at`, `notice_emailed_to` | none (`hazmat_notice` allowed in `public_page_views` but never written) | — | `/hazmat-notice?token=` (note: `token`, not `t`) |
  | Customer portal | `customer_portal_links` (raw `token`, `audience`), `customer_portal_slugs` | — | `public_page_views` `surface='portal'`; the function returns `officeViewStats` to staff | — | `my.clickplumbing.com/<slug>` or `/portal?t=`; office copies via `CustomerPortalGlobeButton` |
  | Bid room | `bid_proposal_rooms` (`customer_id` = the GC) | `bid_proposal_room_events` `link_sent`; `bid_version_sends` | `room_view`, `option_viewed` | `signed` / `declined` events → an `estimates` row | `/bid-room?t=` — raw `public_token` |
  | Submittal room | `bid_submittal_rooms` (`bid_id`), `bid_submittal_people` (per-person token) | `shared_at` | `bid_submittal_events` `view`; `open_count` | `decided`; `bid_submittal_items.review_*` | `/submittal?t=` — raw |
  | Test report | `job_test_reports` | `sent_at`, `sent_to[]`, `sent_pay_url` | none | — | the PDF via `open-test-report-pdf` (portal token) |
  | GC statement | `gc_statement_emails` (`gc_customer_id`), `gc_statement_email_requests` | `sent_at`, `sent_to` | `email_send_log.last_event` only | `gc_review_certifications` | pay link = the portal link |
  | Demand letter · § 53.056 | `job_demand_letters`; `job_lien_desk_items` + `job_lien_filings` (`sends` json) | `sent_at`; `filed_at`, `served_at` | none | — | PDFs |
  | Sub portal · sub contract | `sub_portal_links`, `sub_portal_slugs`; `person_contract_documents` (`person_id`) | `sent_at` | `public_page_views` `sub_portal` → RPCs `sub_portal_visits`, `sub_portal_visit_summary`; `signer_last_viewed_at` | `signed_at` | `/s/<slug>`; `/contract/accept?t=` — **hash only**, nulled on signing |
  | Supply house quote | `bid_rfqs` (`supply_house_id`) | `sent_via`, `sent_to`, `requested_on`, `reminder_count` | `viewed_at` | `status = quoted` → `bid_quotes` | `/q/<token>` — raw |
  | Law firm | `legal_portal_links` (`firm_id`), `legal_firm_recipients` (`confirmed_at`, `paused_at`, `last_digest_at`), `legal_notification_queue` | `sent_now_at`, `digested_at` | `public_page_views` `legal_portal` | — | `/legal?t=` — raw |

  Two rails span surfaces but not by customer: `email_send_log` (every Resend send, keyed by address + `email_type`) and `public_page_views` (three writers: portal, sub portal, legal portal). `buildCustomerActivityFeed` on the Customer page carries no outbound-surface events at all. The sub portal's `sub_portal_visits` RPC is the pattern worth copying.
- **GC companies are `customers` rows** referenced by `jobs_ledger.gc_customer_id`; "is a GC" is derived from that count. The portal audience `all` merges both sides.
- **The Customer page** (`src/pages/CustomerDetail.tsx`, tabs Profile · Estimates · Jobs · Invoices) has no portal link, no journey, no statement history.

## The decision

Build the mock-up's second pass, in this order, each PR alone useful:

1. Make the tab **honest** first: every missing surface as a *Next release* card, two new strips, and a **registry + CI test** so it cannot drift again.
2. **Open it to the office** and put teaching on the cards.
3. **A real person on the strips** — the journey that customer, GC, sub, house or firm has actually had, each card a status and the real link, missing steps carrying the app's own next action; also on the Customer and Job pages as *Their journey*.
4. Then the sample fixtures for the surfaces that still say *Next release*, one audience at a time.
5. Last, the **health row**: people per step and stalls per step, the Needs You doors regrouped by where the customer is.

**Rejected:** copying the four inline email builders into the browser (a second truth — a sample mode on the sender keeps one builder); rendering PDFs as iframes (blank frames — the test-report card's shape is the right one); a separate tab for non-customers (splits the one place that answers "what do they see"); adding new tracking for person mode (the stamps exist; PR 8 reads them).

## The mock-up

[`mockup.html`](./mockup.html) — before, the second pass (a real person's strip on J363's real agreement story, the health row), the first-pass after, the cost table, the critique, the plan, the decisions. Also the Claude artifact *Every outside surface*.

## Where it plugs in

| Exists | New |
|---|---|
| [`customerJourneys.ts`](../../src/lib/customerJourneys.ts) — the pure journeys data (`page` · `email` · `external` · `soon`) | PR 1: five audiences, every missing surface as `soon`; PR 7: `trigger` / `customerCan` / `guide` per step; PR 8: a `person` render layer beside it |
| [`SettingsWhatCustomersSeeTab.tsx`](../../src/components/settings/SettingsWhatCustomersSeeTab.tsx) — strips, thumbs, expanded step | PR 1: the count line; PR 7: teaching on the expanded step; PR 8: Sample / A person mode bar + search |
| [`emailCatalog.ts`](../../src/lib/emailCatalog.ts) — every outbound email, `audience` + `sender` | PR 1: cross-checked by the registry test |
| `settingsGroups.ts` (`dev` only) · `Settings.tsx` (`myRole === 'dev'`) | PR 7: `dev`, `master_technician`, assistant-like; training-mode users see sample only |
| `_shared/customerSample.ts` (fixture) · `_shared/customerSampleFixtures.ts` (responses) · `customerSampleMode.ts` | PRs 2, 4, 6: new fixture people (Sample Supply Co., Sample & Partner PLLC, Sample Owner LLC) and response builders per page |
| `get-job-contract` · `send-job-contract` · `remind-job-contracts` | PR 2: sample branch; `mode: 'sample'` returning `{subject, html, text}` and sending nothing |
| `get-submittal-room` · `send-test-report` · `send-bid-pricing-package` · `gcStatementEmail.ts` (client builder with a parity test) | PR 4 |
| `get-rfq-quote-page` · `send-rfq-email` · `send-supply-house-job-account` · `legal-portal` · `legal-notify-dispatch` · `submit-legal-portal` | PR 6 |
| `src/lib/jobsDocuments/*` — demand letter, lien filings, hazmat notice, physical invoice builders, all client-side | PRs 3 and 5: PDF steps in the test-report card's shape |
| `CustomerDetail.tsx` (Profile · Estimates · Jobs · Invoices) · `DetailJobModal.tsx` | PR 8: *Their journey* section, preselected |
| `sub_portal_visits` / `sub_portal_visit_summary` RPCs · `officeViewStats` on `customer-portal` | PR 8 reads these; PR 9's RPC counts across them |
| `CUSTOMER_SURFACES` registry — **new** [`customerSurfaceRegistry.ts`](../../src/lib/customerSurfaceRegistry.ts) + test | PR 1 |

## The plan

1. **PR 1 · The honest tab** (v2.3505, this branch). Five audiences in `customerJourneys.ts`, every missing surface as a *Next release* card naming its PR; `customerSurfaceRegistry.ts` (every public route in `App.tsx` and every Resend sender → a step or an exempt reason) with a test that reads the real route table and functions folder and cross-checks `EMAIL_CATALOG`; the count line on the tab; the hint reworded to "anyone outside the company". *Client only · S.*
2. **PR 2 · The homeowner's agreement.** `get-job-contract` sample branch (`sample` = out for signature, `sample-done` = signed) + `JobContractSign` honouring `sampleStateFromToken`; `mode: 'sample'` on `send-job-contract` and `remind-job-contracts`; the signed-copy email from `share-job-contract`'s builder (`signedAgreementEmail.ts` is already client-side). Four steps go live. *Client + 3 functions · M. Deploy all three after merge.*
3. **PR 3 · The money paper.** Bill by email (the physical invoice email + PDF, client builders), the hazmat notice (page in sample mode reads a client fixture instead of the RPC; email from the client builder), the terms page (reads live Settings — the sample is the real page). A `pdf` render kind: thumb = first page, expanded = open the PDF, the test-report card's mechanics. *Client only · S.*
4. **PR 4 · The GC's rooms.** `get-submittal-room` sample branch with a decided state + `SubmittalRoom` sample mode; `mode: 'sample'` on `send-test-report` and `send-bid-pricing-package`; the statement email from `gcStatementEmail.ts`; the test-report card becomes the *Test report email* step. *Client + 3 functions · M.*
5. **PR 5 · When it goes wrong.** Demand letter, notice to the owner of record, lien release as PDF steps over the sample job (`demandLetter.ts`, `lienFilingDocuments.ts`, `lienWaiverRelease.ts`); the sample GC job gains an owner of record in the fixture. *Client only · S.*
6. **PR 6 · The two new audiences.** `get-rfq-quote-page` sample + submitted state; `mode: 'sample'` on `send-rfq-email` and `send-supply-house-job-account`; `legal-portal` sample built **from the fixture only**; `mode: 'sample'` on `legal-notify-dispatch` (now, digest) and `submit-legal-portal` (confirm); the confirmed page. *Client + 5 functions · M.*
7. **PR 7 · Open the tab to the office.** `settingsGroups.ts` + `Settings.tsx` gates → dev, master, assistant-like; `users.read_only` (training) held to sample; each step gains `trigger` (what sends it), `customerCan` (what they can do there) and `guide` (help slug), rendered on the expanded step; the help guide's `roles` widened. *Client only · S.*
8. **PR 8 · A person on the strips.** Kernel `src/lib/journeys/journeyForPerson.ts`: given one customer (or GC, sub, house, firm) and the rows the survey table names, produce per-step `{ state: sent|opened|signed|paid|not_yet|never_sent, at, by, link, action }`. Loader per audience through RLS (the office can already read every one of these tables). Mode bar *Sample · A person* + a search on the tab; each card opens the real link (raw tokens where stored; for hash-only links — estimates, sub contracts — the door is *Resend*, the same as today); missing-step cards carry the owning surface's action (Start the sweep, Edit & re-send, Copy link, Ask when they'll pay). The same component renders as **Their journey** on `CustomerDetail` and `DetailJobModal`, preselected. *Client only · L. The one large PR; the one that changes what the tab is.*
9. **PR 9 · The health row.** One read-only RPC `journey_health_counts()` (SECURITY DEFINER, office roles): per step, how many are at it and how many stalled (agreements unopened after N days, bid rooms never opened, portals never visited, statements uncertified this month); doors reused from Needs You. *Client + one migration · M.*

Each PR: `npm run claim`, release note + `docs/recent-features/` fragment, `see-what-customers-see.md` updated, `EDGE_FUNCTIONS.md` section per touched function, and a live pass on the tab at phone and desktop width before merge. `_shared/customerSampleFixtures.ts` edits need **every importer redeployed by hand** — `check:edge-drift` cannot see shared code.

## How to verify

- Dev login as Robert → **Settings → What customers see**. PR 1: the count line reads *N steps across 5 audiences · R rendered live · S next release · 2 sent by another system*; five strips; every *Next release* card names its PR; every existing frame still renders (estimate email → portal, bid room → GC portal, sub portal → signed).
- `npx vitest run src/lib/customerSurfaceRegistry.test.ts` — then add a fake `<Route path="/new-room" …/>` to `App.tsx` locally and watch it fail with *public route /new-room has no entry*.
- PR 8: pick **Michael Palmer** — the agreement card must read *rev 1 opened once · revised twice · signed on paper Sep 4* from `job_contracts` on J363; pick a sub with visits and compare against People → Subs → Visits.
- Phone width (375 px) on the tab: the strips scroll sideways inside their cards; the page does not.

## Gotchas

- **Never render a real matter into the firm's sample.** `legal-portal` sample answers from the fixture and nothing else.
- **A sample mode on a sender must never reach Resend.** Return the built message and stop; keep the branch above the send.
- **Hash-only tokens cannot be re-opened by the office**: estimates (`public_token_hash`) and sub contracts (nulled on signing). Person mode shows the state and offers *Resend*, never a reconstructed link.
- **`hazmat-notice` takes `token=`, not `t=`.**
- **Worktrees are not Supabase-linked** — `supabase functions deploy <name> --project-ref yewfzhbofbbyvkvtaatw`.
- The punch-list generator branch (`claude/reverent-tharp-8b969d`, v2.3497) predates this to-do; whichever lands second rebases the index and board rows.

## Open decisions (taken as proposed on 2026-09-16; the owner may reverse any)

- **The tab opens to the office** (dev, master, assistant-like); training mode sees sample only.
- **The office may open a customer's real page from the strip** — it only gathers links the office can already copy elsewhere.
- **Person mode lives in both places**: Settings (sample default, search beside it) and the Customer / Job pages (*Their journey*, preselected).
- **The supply house and the law firm are strips on this tab**, with the hint widened to "anyone outside the company".
- **Collections paper sits inside the journeys**, after a dashed *when it goes wrong* break, not in its own strip.
- **A sample mode on a sending function is acceptable**, guarded by never touching Resend.
- **The sample GC job gets an owner of record** (Sample Owner LLC) so the notice step can render.
