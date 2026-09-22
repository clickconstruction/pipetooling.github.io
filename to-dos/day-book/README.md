---
name: Day book
number: 20
group: ready
status: in progress · PR 0 census done (`census-2026-09.md`) · PRs 1+2 **shipped** as v2.3542 (#3304, merged 2026-09-17, migration pushed 597/597, live-tested on real rows) · PR 1b (the Stripe send carries its sender, v2.3711) and PR 3 (the Month rhythm grid, v2.3712) shipped 2026-09-22 · PR 7 shipped v2.3714 as a query (approvals' history reconstructed; the rest is an owner call, decision 6) · PR 6a shipped v2.3728 (the Crew Day one-liner; the email half is 6b) · PR 5 shipped v2.3726 (the schedule ledger) · PR 4 shipped v2.3727 (estimators, for payroll viewers) · 4b and 6b remain, being built with the second "best we can do" pass
summary: >
  **Day book**: a People tab that says what each office person and estimator got done on any
  day, read from the actor-stamped records the app already writes — *Billed 3 · J102 J258 J273*,
  *Applied 4 deposits*, *Sent 2 contracts*, *Approved 12 clock sessions*, *Sent 2 bids · $412k* —
  with a week list, a person door, a month grid by kind of work that flags gaps rather than
  scoring volume, today's lines ending in what is left, and an estimating strip measured against
  the person's own trailing months. Nothing is typed; a quiet day says what the app cannot see.
next: >
  PR 6b the Crew Day email's line (a `_for_user` wrapper the dispatcher can call); PR 4b the
  estimator's own door (an owner call on the route or a Bids door); decision 6 (a named-account
  nightly snapshot for bills / deposits / contracts history) is yours.
size: L (7 PRs, 3 migrations, 1 trigger table, 1 cron)
blocker: None for PRs 0–3. Five proposed defaults below stand until the owner says otherwise.
ver: designed 09-16
opinion: later — seven PRs and a cron for management oversight; wait until Grace says she would read it weekly.
---

# Day book — what the office and the estimators got done, any day you look back at

## The ask, in the owner's words

Grace, 2026-09-16: *"KPIs for office staff. When people in the office clock in and clock out they don't want to record everything they do every day, and management staff would like some oversight as to what they are doing. I don't think presenting every click is valuable, but presenting the outcomes is — 'Billed X, Y, and Z' in a daily summary, and 'updated the schedule for 3 or 6 team members'."* Then: *"it could be a tab in People so that users can look back through time"*, then *"let's also think about measuring estimators"*, then the "is this the best we can do?" pass.

## The decision

- **A People tab, "Day book"**, not a block on Crew Day. Crew Day is a today surface; a look-back needs a range, a person filter and a month view. Crew Day keeps a one-line summary per office person with a link into the tab.
- **Nothing is typed.** Every line is derived from a record that already carries the actor's user id. The one exception is read-only: the clock-out note that already exists on every session is shown when present, never prompted for.
- **A quiet day is not a score.** A day with clock time and no recorded outcomes shows *Nothing the app can see*, grey, with the reason (calls, texts, outside email leave no record). It appears in no total and on no strip.
- **The month reads by kind, not by person-volume.** Rows are kinds of work (Billing, Deposits, Contracts, Approvals, Schedule, Bids sent, Robot audits); columns are days; a cell carries the initials of who did it. Three working days with nothing on a row while that queue held work turn amber. That is the manager's sentence: *nobody applied deposits Wednesday to Friday*.
- **Outcomes carry context.** Today's lines end with what is left (*13 open bills left to send*, *48 still waiting*) from the live Needs You counts. History gets the same after a nightly snapshot (PR 7).
- **Estimators are on the same tab**, on the days they clock into a bid, with their own kind chip. Their range strip measures the things that mean something for a bid and compares the person only against their own trailing months. No column ever puts two people side by side.
- **Money follows the payroll gate** for office rows. An estimator sees full values on their own bids (they see them on the Bid Board today); nobody sees another estimator's row without payroll access. The RPC strips amounts server-side; the client never receives a figure it may not show.

**Rejected:** shading the month by outcome count (a click count with better manners); a "quiet days" tile (turns a fact about the app's reach into a number about a person); a "log your day" form (the ask was explicitly not that); bids-per-day anywhere; ranking estimators against each other.

## The mock-up

[`mockup.html`](./mockup.html) beside this file (v3, the one after the pass). Artifact: *Office Days* — https://claude.ai/artifact/6hhWGCLhYZWGNQLbPyj5f2 (Version 2). The earlier Crew Day-row sketch is *Office Day Outcomes* — https://claude.ai/artifact/6GoxkNC4G9K3Bxy1V13HUA; it is superseded except for its source legend, which this document carries.

## What exists versus what is new — the sources, one line each

Verified 2026-09-16 against `src/types/database.ts` and the migrations. **An actor column is what makes a line attributable**; where none exists the line is either dropped from v1 or attributed by a stated fallback.

### Office lines

| Line | Source | Actor · time | State |
|---|---|---|---|
| Billed N · job numbers · $ | `job_activity_events` `event_type='invoice_sent'`; amount via `detail.invoice_id` → `jobs_ledger_invoices.amount` (the join `loadBridgeVectors.ts` already does) | `actor_user_id` · `occurred_at` | exists |
| Applied N deposits · $ | `job_activity_events` `payment_added`; `detail.amount`; a bank deposit when `detail` carries the mercury id | same | exists |
| Moved N jobs to Billed / Paid | `job_activity_events` `status_change` | same | exists |
| Sent N contracts · filed N signed | `job_contract_events` `event_type in ('sent','recorded')` | `actor_user_id` · `occurred_at` | exists |
| Approved N clock sessions · people · hours | `clock_sessions` `approved_by` / `approved_at` (revoked and rejected excluded) | `approved_by` · `approved_at` | exists |
| Reviewed hours · people · range | `hours_reviewed` | `reviewed_by` · `reviewed_at` | exists |
| Answered N dispatch requests | `dispatch_requests` | `closed_by_user_id` · `closed_at` | exists |
| Filed N field reports onto HR | HR file entries (`docs/HR_FILES.md`) | filed-by actor | exists — confirm the column in PR 0 |
| Deleted N records · recoverable | `deleted_records_archive` | `deleted_by` · `deleted_at` | exists · **owner decision 4** |
| Updated the schedule · people · blocks | `schedule_block_events` (v2.3726) — one row per add / move / reassign / remove, from three triggers on `job_schedule_blocks` | `actor_user_id` · `occurred_at` | exists since PR 5 |
| The clock-out note | `clock_sessions.notes` (NOT NULL text, empty when none) | `user_id` · `work_date` | exists · read only |
| Sent N emails / statements | `email_send_log` has no sender | — | **not attributable** · off v1 |

**Attribution caveat that PR 0 must measure:** `job_activity_events.actor_user_id` is `auth.uid()` at trigger time, so anything written by a service-role edge function or a backfill lands with a NULL actor. Those rows are real outcomes nobody on the tab did; the kernel keeps them out of every person's row and the RPC reports their count per day so the tab can say *and 3 more by the system*.

### Estimator lines

| Line | Source | Actor · time | State |
|---|---|---|---|
| Sent N bids · bid numbers · to N GCs · $ | `bid_version_sends` (`sent_on`, `value`, `created_by`); `bids.bid_date_sent_attested_by/_at` as the attestation | `created_by` · `sent_on` | exists |
| Priced Bnnn · N lines | `bid_pricing_assignments` (`updated_by`, `updated_at`) — the only per-line pricing actor. `bid_versions` has no `created_by`, so "N versions" is not attributable | `updated_by` · `updated_at` | exists — phrase changes from the mock-up |
| Recorded a best effort on Bnnn | `bid_best_efforts` | `recorded_by` · `recorded_at` | exists |
| Asked N houses for prices · N quotes in | `bid_rfqs` (`created_by`, `requested_on`); `bid_quotes` (`received_at`, `rfq_id`) | `created_by` · `requested_on` | exists |
| Audited Bnnn · N verdicts · answered N robot questions | `bid_audit_notes` (`author_id`, `digest_outcome` not null = a verdict); `twin_questions` (`answered_by`, `answered_at`) | `author_id` / `answered_by` | exists |
| Followed up N GCs · bid numbers | `bids_submission_entries` (`created_by`, `occurred_at`, `contact_method`) | `created_by` · `occurred_at` | exists |
| Counted Bnnn · N fixtures | `bids_count_rows` has no `created_by`, no `updated_at`; `takeoff_fixture_history` is an RPC with no actor | — | **not attributable** · off v1 · a `count_row_events` ledger is a later PR if wanted |
| Recorded why we lost Bnnn | `bids.loss_category` / `loss_reason` and `bid_versions.loss_category` carry no actor, no timestamp | — | **not attributable as a day line** · the range measure *lost with no reason* is state, not an event, and works |
| Hours on bids | `clock_sessions` where `bid_id` not null and `job_ledger_id` null (the `onBid` rule in `loadBridgeVectors.ts:103`) | `user_id` · `work_date` | exists |

### Estimator range measures (the strip)

| Measure | Rule | Source |
|---|---|---|
| Sent · count · $ | distinct bids with a `bid_version_sends` row in range, `created_by` = person; value = the latest send's `value` | `bid_version_sends` |
| After due date | sent bids whose first `sent_on` > `bids.bid_due_date` | `bids`, `bid_version_sends` |
| Decided · won · lost · $ | `bids.outcome_at` in range, `estimator_id` = person; `started_or_complete` counts as won (the `classifyPulseOutcome` rule in `estimatingPulse.ts`) | `bids` |
| Hit rate, trailing 90 days, by value | `wonValue ÷ (wonValue + lostValue)` over `outcome_at` in the 90 days ending at range end — the `hitRateByValue` rule in `bidCostToWin.ts:42`; shown with the previous 90 days as *was N%* | `bids` |
| Lost, no reason | outcome lost in range with `loss_category` null on the bid and on every version | `bids`, `bid_versions` (the `dashboardLostBidNudge.ts` rule) |
| No follow-up in 7 days | sent in range, no `bids_submission_entries` row within 7 days of first `sent_on`, still undecided | `bids_submission_entries` (the `submissionFollowupStale.ts` threshold) |
| Prices asked → in | median of `bid_quotes.received_at − bid_rfqs.requested_on` over RFQs asked in range by the person | `bid_rfqs`, `bid_quotes` |
| Robot delta | median `twin_shadow_runs.delta_pct` over runs scored in range whose bid's `estimator_id` = person; note `reference_kind` | `twin_shadow_runs` |
| Hours per $100k sent | bid clock hours in range ÷ (sent value ÷ 100,000); *was* = previous range | `clock_sessions`, `bid_version_sends` |

The strip **links** to Bid vs actual (`src/lib/bids/bidVsActual.ts`, Bids → Bid Costs) for realised margin rather than restating it.

## Where it plugs in

- **Tab registry**: `src/lib/people/peopleTabGroups.ts` — add `'day_book'` to `PeopleTab`, `PEOPLE_TABS`, `PEOPLE_TAB_LABELS` (`'Day book'`), and a group. Proposed group: `people`, beside Hours (the `review` group is dev-only and Day book is not). `peopleTabGroups.test.ts` pins the list.
- **Gate + render**: `src/pages/People.tsx` `visiblePeopleTabs` (around L3209) — `day_book: canSeeDayBook`; render branch beside `activity` (around L4248). Tabs render inline, not lazily.
- **Access hook**: `src/hooks/usePeopleAccess.ts` — new `canSeeDayBook` (dev, controller, master, assistant, estimator) and `canPickDayBookPerson` (dev, controller, pay-approved master, i.e. `canAccessPay`). Estimators cannot open `/people` today (`layoutRouteAccess.ts`, v2.2920 dropped the route) — **PR 2 must add a route path for estimators to Day book only**, or give estimators their own door from Bids. Proposed: a `/people?tab=day_book` allow for the estimator role in `layoutRouteAccess.ts`, every other People tab still hidden (`visiblePeopleTabs` already returns false for them).
- **Door**: `src/lib/people/dayBookDoor.ts` modelled on `reviewDoor.ts` — params `dayb_person`, `dayb_from`, `dayb_to` (the bare `person=` param is the Person Desk's; `reviewDoor.ts` documents the prefix rule). `PersonNameDoor` (`src/components/personDesk/PersonNameDoor.tsx`) stays the name's click target inside rows; the tab's own person select is the door.
- **Day bucketing**: `(occurred_at at time zone 'America/Chicago')::date`, the convention in `get_crew_day_payload` (`20260901215024_crew_day_payload.sql:65`). Server-side `America/Chicago` literals are the existing pattern in migrations; the client uses `APP_CALENDAR_TZ`.
- **Live "left" counts** (today only until PR 7): the hooks `DashboardPinnedQuickRow.tsx` already calls — `usePendingHoursApprovalsNudge` (`count_pending_clock_session_approvals`), `useArBankUnallocatedCount` (`count_mercury_transactions_for_bank_payments`), `useJobContractsNudge`, `useBidAuditsPendingCount`, and the open-unsent-bills count from `buildNeedsYouItems` inputs (`src/lib/dashboardNeedsYou.ts:469`).
- **Crew Day**: `get_crew_day_payload` (current definition `20260902001331_crew_day_payload_roles.sql`) gains an `outcomes` key; `src/lib/crewDay.ts` `CrewDayPerson` gains `outcomeLine: string | null`; `DashboardCrewDaySection.tsx` renders it under the job line with the *Day book →* link; `supabase/functions/crew-day-email-dispatch/render.ts` `PersonLine` carries it.
- **Trigger pattern**: copy `jobs_ledger_fields_to_activity` (`20260608010000_job_activity_events.sql:314–355`): `after update of <columns>`, one `if new.x is distinct from old.x` block per column, `actor_user_id = auth.uid()`, `detail = jsonb_build_object('field', …, 'old', …, 'new', …)`.

## What the census changed (2026-09-16 — `census-2026-09.md`)

- **`invoice_sent` is 94 % unattributed** (the Stripe send function writes under the service role). The *Billed* line reads `invoice_billed` ("Marked billed", attributed) plus any attributed send, deduped per invoice; unattributed sends show on the day header as system rows. **PR 1b — shipped v2.3711:** `jobs_ledger_invoices.sent_by_user_id`, written by both send functions from the caller they resolve off the Authorization header; the trigger stamps `coalesce(auth.uid(), new.sent_by_user_id)`. From the deploy on, a Stripe send is the sender's Billed line.
- **Deletions dominate** (7,091 rows / 30 d): the RPC aggregates them per person, day and table.
- **Quiet-day rate is 23 %**, and 56 of 57 office days carry a real clock-out note — the note line earns its place.
- `hours_reviewed` is unused (0 rows / 30 d); the line reads zero. `bid_pricing_assignments` is 98 % robot writes; the human "priced" line is small but real.
- Wendi's strip computes from real rows; a 90-day hit rate on two decisions must show its denominator and grey out under five.

## The plan — seven PRs, smallest shippable first

### PR 0 — the census (no code, one afternoon)

Read-only SQL through the Management API (`SUPABASE_MGMT_TOKEN` in `.env.local`, project `yewfzhbofbbyvkvtaatw`), results saved as `to-dos/day-book/census-2026-09.md`. Every design number above is a guess until this runs.

1. Per source table, last 30 days: rows per day, share with a NULL actor, distinct actors. `job_activity_events` by `event_type`; `job_contract_events` by `event_type`; `clock_sessions` approvals by `approved_by`; `hours_reviewed`; `dispatch_requests` closes; `deleted_records_archive`; `bid_version_sends`; `bid_pricing_assignments`; `bid_rfqs` / `bid_quotes`; `bid_audit_notes` with `digest_outcome`; `twin_questions` answered; `bids_submission_entries`; `bid_best_efforts`.
2. Office clock: distinct users with sessions on the Office job per day, and how many of those days have zero rows in any source (the real quiet-day rate — if it is 40 % the grey line dominates and the design should say so).
3. `clock_sessions.notes`: share non-empty on office sessions; median length.
4. The estimator strip, computed once by hand for Wendi over Aug 18 – Sep 16, to see whether each measure produces a sane figure from real rows.
5. Cost: `explain analyze` of the range query over `job_activity_events` for 31 days with and without an index on `(actor_user_id, occurred_at)`. There is none today.

Stop and redesign if: the NULL-actor share on `invoice_sent` or `payment_added` is above ~20 %, or the quiet-day rate is above ~40 %.

### PR 1 — kernel + RPC (migration 1) — **built as part of v2.3542**

- **Migration** `supabase/migrations/2026MMDDhhmmss_day_book_payload.sql` (number from `origin/main`'s newest, `20260916230000_ar_deposit_close_out.sql` at the time of writing; `SET lock_timeout = '3s';` first line):
  - `create index if not exists job_activity_events_actor_occurred_idx on public.job_activity_events (actor_user_id, occurred_at) where actor_user_id is not null;` and the same shape on `job_contract_events`, `clock_sessions (approved_by, approved_at)`, `bids_submission_entries (created_by, occurred_at)`.
  - `public.get_day_book_payload(p_from date, p_to date, p_person uuid default null) returns jsonb`, `stable security definer set search_path = public`, gating inline the way `get_crew_day_payload` does: `auth.uid()` → role; `dev | controller | pay-approved master` (`has_payroll_access()` or `is_dev()`) → any person, money on; `assistant | estimator` → `p_person` forced to self, money off; anyone else `{'error':'forbidden'}`; range capped at 93 days. Returns `{ from, to, viewer: { can_see_money, can_pick_person }, users: [{id, name, role}], sessions: [...], events: [...], system_counts: [{day, kind, n}] }` where every `events` row is one shape: `{ actor_user_id, day, at, kind, ref_type, ref_id, ref_label, amount_usd, detail }` unioned from the office sources above (estimator sources come in PR 4). When `can_see_money` is false the function emits `amount_usd` as null — the client never receives the figure.
  - Grants as `get_crew_day_payload`: revoke from PUBLIC, grant to `authenticated` and `service_role`; not `anon`.
  - No new table, so no read-only-block calls needed; docs fragment `docs/migrations/<version>_day_book_payload.md`.
- **Kernel** `src/lib/people/dayBook.ts` (pure, tested): types `DayBookPayload`, `DayBookEvent`, `DayBookLine { kind, verb, count, refs: {label, href}[], amountUsd: number | null, detail }`, `DayBookPersonDay { userId, name, role, sessions, hoursMs, lines, quiet: boolean, note: string | null, systemCount }`, `DayBookDay { day, people }`, `DayBookSummary`, `DayBookView`. Functions: `buildDayBookView(payload, opts: { kinds?: DayBookKind[], person?: string })`, `lineSentence(line)` (the *Billed 3 · J102 J258 J273* form; plurals; the tip case reads *incl. a $50 tip on J960* when a `payment_added` detail names a fixture named Tip), `summarise(view)`, `dayBookKinds` (the chip list and each kind's event kinds). Tests: one per verb's grouping and wording, the quiet rule, note surfacing, NULL-actor rows excluded and counted, money null-safe, the person filter, a day with sessions on both the Office job and a bid.
- **Door** `src/lib/people/dayBookDoor.ts` + test.
- **Types**: hand-carry the RPC into `src/types/database.ts` with optionals as `p_person?: string` (not `| null`) so the regen is a no-op (the v2.3499 lesson); `npm run gen-types:linked` after the push.
- Gates: typecheck, lint, `npm test`, `node scripts/theme-tokenize.mjs --check src`. Docs: fragment + release note (`kind: 'feature'`), `docs/migrations/` fragment.
- **Deploy**: merge, then `supabase db push`, then `npm run check:migration-drift`.

### PR 2 — the tab, week view (client only) — **built as part of v2.3542**

- `src/components/people/PeopleDayBookTab.tsx`: toolbar (range stepper — week/month/custom from the door; Week · Month pills with Month disabled until PR 3; person select shown only when `can_pick_person`; kind chips), summary strip (no quiet-days tile), day groups, person rows in the Crew Day row idiom (`li` with `border: 1px solid var(--border)`, `borderRadius: 8`, the `PersonNameDoor` name), lines with the `▸` expand, the grey quiet line, the note in `--note` colours. Loads via `withSupabaseRetry(() => supabase.rpc('get_day_book_payload', {...}))`; a missing RPC (`isMissingRpcError`) renders *This is not live in the database yet — the change still has to be pushed*, the v2.3496 convention, so the client can merge before the push.
- Today's rows read the live "left" hooks; every other day shows lines without "left".
- Registry, gate, route, access hook and render branch as in **Where it plugs in**. Dashboard *Your record* card gets no change.
- `PeopleDayBookTab.render.test.tsx` (`renderWithProviders`): renders the three viewer shapes (payroll viewer with select and money; assistant self-only without money; estimator self-only), the missing-RPC state, and that a bare `person=` param does not open the tab (namespacing).
- Help guide `src/content/help/see-what-the-office-got-done.md` (`title: see what the office got done on any day`, roles dev/master_technician/assistant/controller/estimator) with `{{chip:…}}` tokens for the kind chips; edit `find-my-way-around-the-people-page.md` (it enumerates the groups). Docs: `docs/PEOPLE_TABS_ARCHITECTURE.md` (key list, group table, inventory), `docs/ACCESS_CONTROL.md` (People row + the estimator route note), `docs/GLOSSARY.md` (*Day book*, *quiet day*), fragment + release note.
- E2E: add the tab label to `e2e/` People coverage if a People tabs spec exists; otherwise nothing (rule 6 of `docs/E2E_SMOKE.md`).

### PR 3 — the month rhythm grid (client only) — **shipped v2.3712**

- Kernel `src/lib/people/dayBookRhythm.ts`: `buildRhythm(view, { queueHeldWork: (kind, day) => boolean | null })` → rows per kind, cells `{ day, initials: string[], state: 'done' | 'none' | 'gap' | 'closed' | 'today' }`; the gap rule = the third consecutive working day with nothing on that row while the queue held work (`null` queue knowledge → never amber, so the grid is honest before PR 7). Working days from the Office job's sessions (a day nobody clocked in is *closed*). Tests: gap counting across a weekend, `queueHeldWork` null, a person filter that leaves other initials out, today outlined.
- `PeopleDayBookMonthGrid.tsx` inside the tab; tap a cell → the day peek → *Open the day* sets the range to that day.
- Fragment + release note; help guide gains the Month paragraph.

### PR 4 — estimators (migration 2) — **shipped v2.3727** for payroll viewers; **PR 4b (open)**: an estimator's own door — `/people` is closed to the role (v2.2920), so their self-view needs either a `tab=day_book`-only allowance in `layoutRouteAccess.ts` (the guard is path-based today) or a door from Bids; XS–S, an owner call on which.

- Migration: `create or replace function public.get_day_book_payload(...)` adding the estimator sources to the `events` union (`bid_version_sends`, `bid_pricing_assignments` grouped per bid per day, `bid_best_efforts`, `bid_rfqs` + `bid_quotes`, `bid_audit_notes` verdicts, `twin_questions` answers, `bids_submission_entries`), `sessions` gaining `bid_id` and the bid's number for the hours line, and a new `estimating` key computed server-side only when `p_person` is an estimator or the viewer can pick: the strip measures above, each with a *previous window* twin for the *was* value. Money rule: an estimator's own bid values are always on; another estimator's are on only for payroll viewers.
- Kernel `src/lib/people/dayBookEstimating.ts`: the strip's shape and wording; reuse `hitRateByValue` from `bidCostToWin.ts` and `classifyPulseOutcome` from `estimatingPulse.ts` rather than restating either. Tests per measure, including an empty window and a person with no decided bids (*—*, not 0 %).
- Tab: the Estimating chip (`--est` rail colour, a new token pair in `src/index.css`), estimator rows on their bid-clocked days, the strip replacing the office strip when the chip or an estimator is picked, the Bid vs actual link.
- Docs: `docs/BIDS_SYSTEM.md` one paragraph pointing here; fragment + release note; help guide paragraph.

### PR 5 — the schedule ledger (migration 3) — **shipped v2.3726**

- Migration: `create table if not exists public.schedule_block_events (id bigint generated always as identity primary key, block_id uuid, job_id uuid, bid_id uuid, assignee_user_id uuid, work_date date, change text check (change in ('added','moved','reassigned','removed')), old jsonb, new jsonb, actor_user_id uuid references public.users(id), occurred_at timestamptz not null default now())`; RLS select for `is_dev() or has_payroll_access() or actor_user_id = auth.uid()`, no client insert; triggers `after insert`, `after update of work_date, time_start, time_end, assignee_user_id`, `after delete` on `job_schedule_blocks`, each `security definer` writing `actor_user_id = auth.uid()`; index on `(actor_user_id, occurred_at)`. **Ends with BOTH `select public.apply_read_only_write_blocks();` and `select public.apply_read_only_stmt_blocks();`** (new table).
- RPC: `create or replace` adding the ledger to the union; the kernel gains the *Updated the schedule · N people · N blocks, Thu–Fri* line (people = distinct `assignee_user_id`, blocks = distinct `block_id`, the day span from `work_date`).
- The schedule's own dispatcher writes (`dispatch_office_schedule_fills`) are already attributed and join as *marked N days filled*.
- Fragment, migration fragment, release note; `docs/SCHEDULE_DISPATCH_ARCHITECTURE.md` one line.

### PR 6 — Crew Day one-liner + email — **6a shipped v2.3728** (the Dashboard line, client only: the section reads `get_day_book_payload` for its day as the viewer, so no RPC change); **6b open**: the email — the dispatcher runs as the service role, which the Day book RPC refuses, so it needs a `get_day_book_payload_for_user(p_user_id, p_day)` wrapper (the `get_crew_day_payload_for_user` pattern), `PersonLine.outcome` in `render.ts`, and a redeploy of `crew-day-email-dispatch`.

- `get_crew_day_payload` and `_for_user` (`create or replace`, the current bodies from `20260902001331`) gain `outcomes: [{user_id, line}]` for office-role people, built by calling the same SQL the Day book uses for one day; the email variant respects the recipient's money gate.
- `crewDay.ts` `CrewDayPerson.outcomeLine`; `DashboardCrewDaySection.tsx` renders it with the *Day book →* link (`dayBookDoor` href for that person and day); `crew-day-email-dispatch/render.ts` `PersonLine` + one `<td>`; **redeploy** `crew-day-email-dispatch` (`supabase functions deploy crew-day-email-dispatch`; `npm run check:edge-drift`).
- Render-smoke additions in `DashboardCrewDaySection.render.test.tsx`; `docs/EDGE_FUNCTIONS.md` crew-day section; fragment + release note.

### PR 7 — history carries "left" — **shipped v2.3714 as a query, not a snapshot**

The second "best we can do" pass asked whether the queue could be reconstructed instead of snapshotted. Approvals can, exactly (clock-out, approval, rejection and revocation are all stamped), so `get_day_book_payload` returns `queue: [{day, kind: 'approvals', n}]` for every day up to today with no table and no cron, true for days before the change; the Month grid's Approvals row goes amber and past Approved lines end with *N still waiting*. Bills to send (an invoice's "ready" moment is not stamped), deposits to match (a settings filter applied for a signed-in caller) and jobs without a contract (a client kernel) cannot be reconstructed; a nightly snapshot for them would have to run as a named account — **owner decision 6**. The plan as drawn, for that case:

#### As drawn — the nightly queue snapshot (migration, cron)

- Table `day_book_queue_snapshots (day date, kind text, n integer, usd numeric, taken_at timestamptz, primary key (day, kind))`, read-only blocks both, RLS select for the Day book roles.
- Function `public.take_day_book_queue_snapshot()` writing one row per kind from the same counts the Needs You hooks use (`count_pending_clock_session_approvals`, `count_mercury_transactions_for_bank_payments`, open unsent bills, jobs without a contract, robot audits waiting, bids due this week still open), invoked at 23:55 Chicago by the existing cron edge pattern (a small `day-book-snapshot` function on the schedule the other `*-dispatch` functions use; `docs/REPORT_SUBSCRIPTIONS.md` has the checklist).
- RPC gains `queue: [{day, kind, n}]`; the kernel's *left* rendering switches from live-today-only to snapshot-for-history; the rhythm grid's `queueHeldWork` stops returning null.
- Fragment, migration fragment, edge function section, release note.

## How to verify

Local: this worktree pattern — `.env.local` symlink, Vite on a free port (`npm run dev -- --port 519N --strictPort --host 127.0.0.1`), `http://127.0.0.1:519N/dev-login?as=1&to=/people?tab=day_book`. Dev login is Robert (dev), which is the payroll-viewer shape; the assistant and estimator shapes are covered by the render smokes and by reading the RPC as those roles through the Management API (`set role authenticated; set request.jwt.claims …` in a read-only transaction).

- **PR 1**: after the push, call the RPC from the browser console for `2026-09-08`..`2026-09-14` and check the `events` count against the census; confirm `amount_usd` is null for an assistant.
- **PR 2** (done 2026-09-17, local Vite on real rows after the push): the week of Sep 8–14 as Robert read *Applied 6 deposits · J1010 J891 J991 J967 J992 J999 · $23,449* and *Moved 4 jobs to Paid* on Taunya's Thursday, *Billed 1 · J967 · $3,197* on Friday, the quiet line on her 12-minute Wednesday-evening session, four clock-out notes on a four-session Tuesday, *and 11 more by the system* on Friday's header (the Stripe sends), and the $50 tip on J960 as *Applied 1 deposit · J960 · $50* on Robert's Sep 16. Person select lists the six office-role users. 375 px: no sideways overflow. Not yet checked: dark theme, the door URL pasted into a fresh tab.
- **PR 3**: Month for September; the Robot audits row should show the real gap (audits were waiting at 27–31 through the week of Sep 8 — check against `bid_audits`). No amber anywhere until PR 7 (`queueHeldWork` is null).
- **PR 4**: pick Wendi; the strip must reproduce the PR 0 hand-computed figures exactly.
- **PR 5**: move one schedule block on the Dispatch board, then reload the Day book; the line appears on Robert's row for today; move it back.
- **PR 6**: Crew Day shows the one-liner for Taunya today; the email — trigger the dispatch for Robert only through the Crew Day ✉ (it already exists) and read the row.
- **PR 7**: next morning, yesterday's rows carry *left* figures and the grid can go amber; compare one figure with the Needs You card at the snapshot time.

Gotchas already known: `:hover` / `:focus-within` need a class in `src/index.css`, and an inline `border` shorthand beats it (v2.3494); in modals, a write that changes a list must refresh both owners (v2.3499) — the tab has no writes, so this only touches PR 6's Crew Day; the Browser pane's hidden tab never fires `requestAnimationFrame`, so verify any animated expand with computed style, not a screenshot.

## Owner decisions (defaults stand until answered)

1. **Name**: *Day book*. Alternatives *Office days* (excludes estimators), *Outcomes*.
2. **Who sees whom**: dev, controller and pay-approved masters see everyone with amounts; assistants and estimators see themselves without others' amounts; superintendents, subs, helpers and primaries do not see the tab.
3. **The amber gap rule**: three working days.
4. **The deleted-records line**: keep (recoverable, and management asks for it) — or drop as too close to surveillance.
5. **Estimator money**: an estimator sees full values on their own bids on this tab, as on the Bid Board.
6. **A named-account nightly snapshot** (v2.3714): bills to send, deposits to match and jobs without a contract carry "left" on today only, because their history cannot be reconstructed and the count RPCs refuse a cron. A nightly `day_book_queue_snapshots` fill would have to run under a dev account's claims (`set_config('request.jwt.claims', …)` inside the function) — say whether that is acceptable, and which account. Default: not built; approvals' history is exact today.

## Left deliberately out of v1

Counted fixtures (no actor on `bids_count_rows`), why-we-lost as a day line (no actor), sent emails (no sender on `email_send_log`), any cross-person ranking, any typed input, and exporting or emailing the tab itself (Crew Day's email carries the one-liner; a *Day book* email stream is a later question for `docs/REPORT_SUBSCRIPTIONS.md`).
