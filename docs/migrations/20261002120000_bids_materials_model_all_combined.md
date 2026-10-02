# 20261002120000_bids_materials_model_all_combined.sql (2026-10-02, v2.4405)

Punch list #77, PR 3. Sets `bids.materials_model = 'rough'` on every bid that is not already, and restates the column comment. One column on `bids`; no other table is touched. The owner, 2026-10-02: "I want the data to match the app so later audits and reviews can be more successful."

**Why it is safe to say every bid is Combined.** By Stage was switched off in v2.4389 and its code deleted in v2.4396. Since then no client code reads the column, and in SQL only `duplicate_bid_to_service_type` names it, to copy it. The flag was the column's default until April 2026, which is why so many bids carried it.

**Recount on prod, 2026-10-02, read-only** (psql over the session pooler with `default_transaction_read_only=on`). It matches the plan's count of 2026-10-01.

| | Bids |
|---|---|
| All | 409 |
| `rough` (Combined) | 258 |
| `exact` (By Stage) | 151 |
| …of those, holding By Stage picks (`bids_takeoff_template_mappings`) | 4: B82 (4), B85 (1), B159 (4), B403 (9, the ZZ Twin test bid) |
| …linking stage purchase orders | 3: B82 (2), B83 (2), B85 (1) |
| …holding any By Stage data | 5 |
| …holding none | 146 |
| …with counts | 66 |
| …with Combined part lines parked under them | 1: B159 |
| …created since June 2026 | 1: B403 |

Two bids already flagged `rough` also keep old picks: B138 (6) and B287 (1). The picks table holds 25 rows in all. None of this moves: the picks and the PO links stay where they are, unread by the app. `bid_estimate_breakdown` and `bid_pricing_history` still count a linked stage PO first, for B82, B83 and B85.

**The 151 bid numbers**, so the record of which bids carried the flag outlives the flag: 2–17, 19–46, 48–80, 82, 83, 85, 87–91, 93–96, 98–102, 104, 106–111, 113–119, 121–129, 131–134, 136, 137, 139–143, 145–147, 149, 152–156, 158–165, 167–170, 247, 403.

**`updated_at` is not touched.** `update_bids_updated_at` stamps `updated_at = now()` on every row update, and 80 of the 151 had been edited in the last 30 days, so a plain `UPDATE` would have made 151 bids look worked on tonight. The migration disables that one trigger, updates, and enables it again inside a single `DO` block: one statement, so if anything fails the trigger is on and nothing changed. `ALTER TABLE … DISABLE TRIGGER` takes a `SHARE ROW EXCLUSIVE` lock: readers go on, a writer to `bids` waits a few milliseconds, and `lock_timeout = '3s'` gives up rather than queue.

**The other triggers on a bid update**, read from prod the same night:

| Trigger | Fires here? |
|---|---|
| `bids_mint_labor_on_send`, `bids_score_shadow_on_send_trg`, `bids_stamp_outcome_at` | No. Each is `UPDATE OF` a column this does not touch. |
| `bids_prevent_estimator_primary_edit_bid_number` | Runs, does nothing: the bid number does not change. |
| `twin_no_review_guard`, `twin_no_send_guard` | Run, do nothing: a migration is not a twin. |
| `read_only_block_stmt` | Runs, does nothing: a migration is not a training account. |
| `bids_clear_working_board_archive_on_progress` | Runs. It un-archives a bid that is sent or decided. 14 of the 151 were archived and none of those was sent or decided, so it changes nothing. |

**The CHECK still allows `'exact'`.** Tightening it to `'rough'` alone would refuse a bid row restored from the deleted-records archive if it was deleted before tonight. The comment on the column says the value is always `'rough'` and why.

**Tested** on a throwaway copy of the whole schema (`npm run test:pg:materials-model-flip`): two old bids flagged By Stage and one Combined, each given a March `updated_at`; after the migration all three are `rough`, the dates and a sent date have not moved, the trigger is enabled, an ordinary edit stamps `updated_at` again, and a second run updates 0 rows.

Idempotent. Apply with `supabase db push` after the PR merges. No client change, so deploy order does not matter, and the types do not change.
