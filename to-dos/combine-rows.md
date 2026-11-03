---
name: "Combine: every row that goes with the source job, sorted"
number: 252
group: gated
status: PR 1 built 2026-11-02 (v2.6423, the move, merge and let-go rows that are not money or legal); PR 2 built 2026-11-03 (v2.6458, the money and legal rows, on the owner's word); left are the six soft job pointers under *Also noted*
mockup: not required — a database rule and a guide section, no screen changes
summary: >
  A job combine moved a named list of tables and deleted the source row, and ON DELETE CASCADE took every other row
  that named the job: 52 tables on prod's catalog on 2026-11-02, 31 of them with rows, job_activity_events about
  13,700. The guide said everything real moves. This card sorts every one of them into move, merge or let go with its
  reason. v2.6423 did the rows that are not money or legal; v2.6458 did the money and legal rows on the owner's word
  (bills and payments keep the billing guard). Six tables that name a job with no foreign key are left.
next: A third small migration for the six tables under *Also noted* that name a job in a plain uuid column: a rule and a bed row each (the AR cases and the rating move; the notices, offers and schedule events are history that moves too, or is let go with a reason), then retire the card.
size: S
blocker: none
opinion: build — the rules are the ones the tables' own keys ask for; the one open call, a live Lien desk item on both jobs, was built as *the source's comes over voided* and is a one-line flip to a refusal if the desk wants the hold
---

# Combine: every row that goes with the source job, sorted (#252)

## The ask

The session that built punch list #237 (v2.6350, a stage's checklist follows its line through a split or a combine)
found that a combine's delete cascades through far more than checklists. `report_photos` was fixed there; the rest
were left as out of scope and handed over on 2026-11-02 with the instruction: sort each table into move, merge or let
go with the reason, write the list down, move what should move, and confirm with the owner before changing what a
combine does to money or legal rows. Combines are in real use: six HouseCall Pro import shells were combined into one
job on 2026-11-01. The guide *combine two duplicate jobs into one* told people everything real moves, so a gap here was
silent data loss, although a dev can restore a removed job's rows for 90 days (`deleted_records_archive`, which covers
17 of the cascading tables, not all 52).

## How the list was read

The dev MCP seat answered revoked, so the list comes from the migrations: every `REFERENCES jobs_ledger … ON DELETE
CASCADE` in `supabase/migrations/` (71 foreign keys on 2026-11-02, 90 tables name `jobs_ledger` in the generated
types once the `SET NULL` ones are counted), less the tables the RPC already moved. The RPC's body is in
`supabase/migrations/20261103054522_combine_moves_every_row.sql`; before it 20261102143000 (v2.6350), 20261031020000
(v2.6226), 20260929123000 (v2.4139). Read the catalog again before PR 2: `SELECT conrelid::regclass FROM pg_constraint
WHERE confrelid = 'public.jobs_ledger'::regclass AND confdeltype = 'c'`.

## Move (a plain change of job) — shipped in v2.6423

| Table | Why |
|---|---|
| `job_activity_events` | The job's history; the biggest table (about 13,700 rows). Each moved row's `detail` gains `combined_from_job_id`, as a moved status event keeps `source_job_id`. |
| `job_pct_events` | Percent-done history. |
| `job_followup_reviews` | Looks fine stamps and snoozes. |
| `job_test_reports` | Test reports, some sent to the customer. |
| `job_share_links` | A texted link keeps working. |
| `job_photo_notes` | Job photos (#244); the line pointer stays. |
| `job_hazmat_incidents` | The incident record with its photos and testimonials; its fee bill is the billing guard's. |
| `hours_statements` | A signed hours statement is a record with an id on the paper. |
| `material_po_generator_entries` | PO codes handed out for the job. |
| `nudge_sent`, `drive_links`, `email_tag_threads` | Messages history and our own links to Drive files. |
| `supply_house_job_accounts`, `supply_house_invoice_move_requests` | The share-with-supply-house send log and the move-window asks. |
| `step_commitments` | Work orders, unless both jobs hold a live one for the same sub (below). |
| `plan_sets.job_id` | The job that made an as-built; `SET NULL` before, so a delete forgot it. |
| `job_stage_windows` | Follows its line through either door, by the fixture trigger; a repair rejoins windows an earlier split stranded. |

## Merge (the table's own unique key asks for a rule) — shipped in v2.6423

| Table | Key | Rule |
|---|---|---|
| `job_places` | one name per job | The target's place of the same name takes the source's containers and container moves; the source's place goes. |
| `job_containers` | one live label per job | The job's Unsorted pile is the catch-all: the source's folds into the target's (movements, moves and photos re-pointed). A cage or box keeps its own row, since its code is printed on its label, and takes `Cage A (2)` (then 3, up to 9). |
| `contact_jobs` | one link per contact and job | The target's stands once; the star moves to it when the source's link had it. |
| `contact_step_skips`, `call_tasks` | one open per contact and step | The target's open one stands; done calls and undone skips move as history. |
| `nudge_holds` | one open per contact and step | The target's stands with the later of the two days. |
| `photo_saves` | one tick per job | The target's stands, else the source's comes over. |
| `job_watchers` | one per job and person | Added with their picks, as the team is. |
| `job_supply_house_accounts` | one per job and house | An open account on the source opens the target's row (status, ref, how and when it opened); otherwise the target's stands. |
| `job_supply_house_words` | one per job and house | The later word stands and keeps who noted it and when (the stamp trigger now leaves a move alone). |
| `team_board_acks` | one per kind, day, person and target | The target's stands; the rest move with `target_key` rewritten. |
| `job_expected_hours` | one open per job | The target's number stands; the source's open row comes over closed, stamped by the person combining. |
| `plan_parts` | one part per job | A target with none takes the source's part and names it in `plan_part_id`; a target with its own keeps it and its current set, and the source's sets join it as older sets. |
| `job_baselines`, `job_budgets`, `job_property_owners` | one row per job | The target's stands, else the source's moves. A baseline or a budget is a snapshot with a date; the office re-keeps one for the combined job. |

**One refusal**: `step_commitments_job_person_live_uniq` allows one live job-anchored work order per sub on a job, and
neither order should be cancelled by a rule, so a sub both jobs hold a live order for answers `work_order_collision`
(*Both jobs hold a live work order for <sub>. Cancel one of them, then combine.*), as a supply allocation past 100 %
already did.

## Let go on purpose

| Table | Why |
|---|---|
| `jobs_ledger_thread_note_stats_cache` | A cache; the notes' move recomputes the target's row by trigger. |
| `job_travel_times` | A routed drive-time cache keyed by a pair of jobs; recomputed on demand. |
| `paid_job_email_queue` | A mail queue and log about the card that is going. |
| `common_jobs` | Deleted by the RPC since the start. |
| `job_collect_payment_flows` | One per job, under the billing guard: a source with one is refused unless `p_allow_billed`. |

## Money and legal rows — shipped in v2.6458 (the owner's word, 2026-11-03)

Until v2.6458 each of these went with the source's delete (or was refused by the billing guard). The owner said build
with the rules proposed here; `20261103160000_combine_moves_money_and_legal_rows.sql` restates the body with them, one
line per table, and the bed holds a row each. Bills and payments keep the guard.

| Table | Before | Rule as built |
|---|---|---|
| `jobs_ledger_invoices`, `jobs_ledger_payments` | The billing guard refuses a source with either unless `p_allow_billed` (Delete job → Reassign to another job…), where they go with the source by design. | As before. |
| `jobs_ledger_payment_events` | The trace of a payment moved off the source was deleted, so the job it went to lost its grey trace line. | Move: `from_job_id` and `to_job_id` that name the source take the target. |
| `job_payment_promises` | Promises and paid claims (voided ones included) went. | Move. |
| `job_promised_pay_dates` | One per job; went. | Merge: the later `marked_at` stands. The move keeps the date, so `job_promised_pay_dates_log_promise` writes no second promise. |
| `job_payment_chase_touches` | The chase call log pinned to the job went. | Move. |
| `job_lien_filings`, `job_lien_releases`, `job_demand_letters` | § 53.056 notices, affidavits, waivers and demand letters sent went. | Move; they are the record of what went out. A bid's waiver names no job and is untouched. The activity triggers fire on state changes only, so a move writes no event. |
| `job_lien_desk_items` | The desk's queue items went. One live per job and kind (`job_lien_desk_items_live_uniq`: not voided, not sent or missed). | Move; a live item of a kind the target holds live comes over voided (`voided_at`), so the desk still reads it and nothing is lost; the target's stands. The refusal was the other way offered; a hold on a draft was judged the worse trade, and it is a one-line flip. |
| `job_lien_claim_corrections` | One per job; went. | Merge: the target's stands, else the source's moves. |
| `legal_matter_jobs` | The matter's link to the job went. | Merge: the matter links to the target once. |
| `job_contracts` | Agreements went, with their signed PDFs and the customer's links. One live (draft or sent) per job. | Move; both jobs with an open agreement: `agreement_collision`, *Both jobs hold an open agreement. Void one of them, then combine.* |
| `job_pay_applications` | AIA applications went. One live number per job. | Move, the saved stamp kept (`job_pay_applications_stamp` restated with a gate for a job-only change); both jobs with live applications: `pay_application_collision`, *Both jobs hold pay applications. Delete one job's applications, then combine.* |

## Also noted

- A split leaves a work order on the old job while its stage window moves with the line (`step_commitments.stage_window_id` then points across jobs). The split moved no work orders before either; a question for the Work Orders tab, not this card.
- `job_photo_notes.fixture_id` names a line but the split does not carry the photo with the line; #244 shipped the same day and may want to.
- Deleting a job outright, or moving its costs to a bid (`migrate_job_ledger_costs_to_bid_and_delete`), still takes every row here; the bid has nowhere for most of them.
- Six tables name a job in a plain uuid column with no foreign key, so no cascade reaches them and this PR's list (read by foreign key) left them out: `ar_stripe_cases.job_id`, `ar_unbanked_check_cases.job_id`, `customer_ratings.job_id`, `job_watcher_notices.job_id`, `nudge_offers.jobs_ledger_id`, `schedule_block_events.job_id`. After a combine each keeps the source's id, which no job answers to. The AR cases and the rating look like moves; the notices, the offers and the schedule events are history that a reader joins by job. A follow-up gives each its rule and a bed row.

## How to verify

The bed `scripts/pgtest-combine-rows.sh` (`supabase/tests/combine_rows/20_scenario.sql`) runs in CI on a PR that
touches a migration and plays every rule above on made-up jobs; read the `ok:` lines. Live, on the dev server as the
dev: two ZZ Test jobs with a place, a container, a watcher and a plan set each, Pipeline → Combine / Separate… →
Combine, then the target's Job window shows the source's history, materials on site and plans. Delete the ZZ rows after.
