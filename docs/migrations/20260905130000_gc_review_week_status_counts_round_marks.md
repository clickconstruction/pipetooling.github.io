# 20260905130000_gc_review_week_status_counts_round_marks.sql (2026-09-05, v2.2842)

`CREATE OR REPLACE FUNCTION public.gc_review_week_status(p_week_start date)` — the Dashboard GC-review nudge's RPC, third version. Idempotent, no table changes, no new grants (re-issues the existing `authenticated` execute). Same signature and the same four keys (`gcs_outstanding`, `gcs_certified`, `gcs_sent`, `gcs_done`); the outstanding and certified CTEs are byte-for-byte the v2 body (`20260903184432`).

**Why.** `gcs_sent` counted only `gc_statement_emails` rows — app sends. The personal statement round's "Sent it ✓" writes `gc_statement_round_marks`, so a week completed through the ritual's own preferred lane read "0 statements sent" Wednesday through Saturday, the Needs-you badge sat at `outstanding` all week (v2.2705 made the badge `outstanding − done`), and the copy told the office to "send each statement off" — statements that had already gone out. Live-proved on Wednesday 2026-09-03: RPC `{10, 10, 0}`, marks table empty for the week, and the only sends were whole-report internal copies with `gc_customer_id` NULL. Every other surface already counted marks: the modal strip (`mergeMarksIntoLastSent`), and `get_statement_round_for_user`'s `last_statement` = `GREATEST(max sent-mark acted_at, max gc_statement_emails.sent_at)` (`20260905044344`).

**Before / after — the `sent` flag inside the `flags` CTE.**

```sql
-- before (v2)
exists (
  select 1 from public.gc_statement_emails e
  where e.gc_customer_id = g.gc_customer_id
    and (e.sent_at at time zone 'America/Chicago')::date >= p_week_start
) as sent

-- after (v3)
(
  exists (
    select 1 from public.gc_statement_emails e
    where e.gc_customer_id = g.gc_customer_id
      and (e.sent_at at time zone 'America/Chicago')::date >= p_week_start
  )
  or exists (
    select 1 from public.gc_statement_round_marks m
    where m.gc_customer_id = g.gc_customer_id
      and m.week_start = p_week_start
      and m.action = 'sent'
  )
) as sent
```

Semantics, aligned with `get_statement_round_for_user`:

- Marks ∪ emails, `action = 'sent'` only. `contacted` (v2.2813: "counts for the week and never as a statement") and `skipped` never count.
- Marks are scoped by `week_start = p_week_start` — the same row the modal loads (`listGcStatementRoundMarks(certWeekStart)`) and the round RPC's `marks` CTE reads; the unique index `(week_start, gc_customer_id)` serves the lookup.
- Whole-report "All GCs" copies audit in `gc_statement_emails` with `gc_customer_id` NULL and remain excluded (the emails predicate needs a per-GC id; marks are NOT NULL on `gc_customer_id` and are per-GC by construction).
- `gcs_done` inherits the change, so `gcReviewGcsToDo` can reach 0 and `gcReviewNudgeState` can return `done`.

**Verify after push.** For the current cert week `W` (Monday, Chicago):

```sql
-- 1. The RPC's sent count…
select public.gc_review_week_status(:W) ->> 'gcs_sent' as gcs_sent;

-- 2. …equals the union of per-GC email rows and sent marks, restricted to the
--    RPC's outstanding set (GCs with a live total > 0 — reuse the v2 CTEs or
--    simply compare against the modal's strip at the same instant).
select count(*) from (
  select gc_customer_id from public.gc_statement_emails
   where gc_customer_id is not null
     and (sent_at at time zone 'America/Chicago')::date >= :W
  union
  select gc_customer_id from public.gc_statement_round_marks
   where week_start = :W and action = 'sent'
) s;

-- 3. A contacted mark alone must not count:
--    insert/observe a row with action = 'contacted' for an otherwise-unsent GC
--    → gcs_sent unchanged. A skipped mark: unchanged.
```

In the app: Sent it ✓ on a certified GC → the Dashboard card's "N statements sent" rises by one and the badge falls by one; "Spoke with them · no statement" → neither moves; all outstanding GCs certified and sent → the Wednesday card is green, the badge 0.

**Deploy order.** Either order — same shape, additive semantics. Client-first is a no-op (the only client change is a doc comment and a guide).

**Rollback.** Re-run `20260903184432_gc_review_week_status_v2.sql` — same signature, so no client change is needed; the banner simply goes back to counting app sends only.
