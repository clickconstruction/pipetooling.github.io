# 20261115233000_lien_closed_paid_to_activity.sql (2026-11-15, v2.7359)

A lien notice closed because the job was paid gets its line in the job's trail. The run's **Close paid notices** press (v2.7353) sets the § 53.056 desk item aside (`voided_at`) and keeps one record on it, `fields.runClosedPaid` — when, who, when its packet printed, what the paper claimed. Every desk reader skips a voided item, so without a line the job's History never says a notice was drafted, printed and then not sent. `job_activity_events` takes no client insert (its lines are the triggers' and the RPCs'), so this writes it the way the courtesy notice's line is written (`20261101092703`):

- `job_activity_line_lien_closed_paid(job_lien_desk_items)`: one line per closed notice — *Lien notice for Sep 2026 closed by Dana · the job was paid, nothing was mailed — the paper said $2,400.00* — guarded by `detail->>'source_id'` = the item's id, at the close's time, financial, in the Billing bucket, event type `lien_notice_closed_paid`. A record with no set-aside, a set-aside with no record (a job combine's) and any kind but the monthly notice write nothing; a record missing its name, its months or its claim still reads.
- `job_lien_desk_items_closed_paid_to_activity()`, SECURITY DEFINER, AFTER UPDATE OF `voided_at`, `fields` on `job_lien_desk_items` when the row is set aside and carries `runClosedPaid`: a line that fails is a warning, never a lost close.
- Both revoked from `public`, `anon` and `authenticated`; a backfill at the end writes the lines for closes already made.

No table or column changes; idempotent (`CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`). Apply order: with v2.7359's merge, `supabase db push`. The client calls nothing new, so nothing waits on the push; until it lands a close keeps its record on the notice and the History shows no line, and the backfill writes it then.

Bed: `npm run test:pg:lien-closed-paid-activity` (`supabase/tests/lien_closed_paid_activity/`, stand-in tables): the backfill, a close now, no second line on a later update, the rows that write nothing, a thin record, and the revokes.
