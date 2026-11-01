# 20261101092703_lien_courtesy_to_activity.sql (2026-11-02, v2.6269)

The courtesy notice's line in the job's trail (punch list #231, PR 3). A press on the Lien desk's sent footer (v2.6261) appends one record to the sent § 53.056 desk item's `fields.courtesy[]`; the first cut wrote the `lien_courtesy_sent` line from the client and the table refused it (its lines are the triggers' and the RPCs'), found in the ZZ Test live run of 2026-11-01. This writes it the way the notice's and the demand letter's lines are written (`20261019030000`):

- `job_activity_line_lien_courtesy(job_lien_desk_items)`: one line per record on the item — *Courtesy notice sent by Grace · email to the GC and the owner, text to the GC · named Dec 15 — $4,850.00* — guarded by `detail->>'source_id'` = `<item id>:<index>`, at the record's time, financial, in the Billing bucket; a press where every channel was refused is no line; a voided item or a drafted one writes nothing.
- `job_lien_desk_items_courtesy_to_activity()`, SECURITY DEFINER, AFTER UPDATE OF `fields` on `job_lien_desk_items` when the row carries `courtesy`: a line that fails is a warning, never a lost record.
- Both revoked from `public`, `anon` and `authenticated`; a backfill at the end writes the lines for presses already made.

No table or column changes; idempotent (`CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`). Apply order: with v2.6269's merge, `supabase db push`. The client calls nothing new, so nothing waits on the push; until it lands a press keeps its record on the notice and the History shows no line.
