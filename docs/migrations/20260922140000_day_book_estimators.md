# 20260922140000_day_book_estimators.sql (2026-09-22, v2.3727)

**Purpose**: estimators on the Day book, and the estimating strip (Day book PR 4).

**Changes** — `CREATE OR REPLACE FUNCTION public.get_day_book_payload(date, date, uuid)`, the body of `20260922120000_schedule_block_events.sql` (PR 5) with:
- `people` gains `role = 'estimator'`; `sessions` carry `bid_id`.
- Seven estimator sources in the `ev` union: `bid_version_sends` (`bid_sent`, at noon Chicago of `sent_on`, `amount_usd` = the send's `value` when the viewer may see money or is the sender, `detail.gcs` = `bid_gcs` count), `bid_pricing_assignments` grouped per `updated_by` × bid × day (`priced`, `detail.lines`), `bid_best_efforts` (`best_effort`), `bid_rfqs` (`rfq_asked`, `detail.quotes_in`), `bid_audit_notes` with `digest_outcome` (`audited`), `twin_questions` answered (`robot_answered`), `bids_submission_entries` with `contact_method` (`followed_up`). All `ref_type = 'bid'`.
- `bids` in the result (`id`, `bid_number`, `project_name`) for the rows' and sessions' bids.
- `estimating` (NULL unless `p_person` resolves to one person): `windows.now` / `windows.was` over `[v_from, v_to]` and the equal window before it — `sent_n / sent_usd / late_n / unfollowed_n` (`strip_sent`), `won_n / lost_n / won_usd / lost_usd / lost_no_reason_n` (`strip_decided`, `outcome_at` in window; won = won · started_or_complete · signed), `hit_rate / hit_decided_n` (`strip_hit`, the 90 days ending at the window's end, by value), `rfq_asks_n / rfq_median_days`, `robot_runs_n / robot_median_delta` (`twin_shadow_runs` scored in window whose reference bid's estimator is the person), `bid_hours`. Money = `v_money OR v_person = auth.uid()`.

**Idempotent**: `CREATE OR REPLACE`; grants unchanged. Additive. **Order**: after `20260922120000` (PR 5).
