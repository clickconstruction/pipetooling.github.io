# 20261119020000_lien_void_puts_paper_back.sql (2026-11-18, v2.7892)

Voiding a filed lien affidavit puts its paper back on the Lien desk, in the same transaction as the void. It ships with the client that says where the paper went ([v2.7892](../recent-features/v2.7892.md)).

Recording a filed affidavit marks the job's affidavit paper as sent and ties it to the filing (`job_lien_desk_items.status = 'sent'`, `sent_filing_id`, `sent_at`). Void only set the filing's `voided_at`. The paper stayed sent and tied to a voided record, so the Board read the lien as **Served** with no lien on file, and a second record on the job never reached the paper.

No table changes. Two functions and one trigger.

| Object | What it is |
|---|---|
| `job_lien_desk_items_guard()` | Replaced. The body as [`20261023150000`](./20261023150000_lien_sign_code.md) left it, with one block after its first test and nothing else changed (the two bodies diff to those eleven lines). |
| `job_lien_filing_void_restores_paper()` | New. `SECURITY DEFINER`, a trigger function. `EXECUTE` revoked from `PUBLIC`, `anon` and `authenticated`. |
| Trigger `job_lien_filing_void_restores_paper` on `job_lien_filings` | New. `AFTER UPDATE OF voided_at`, `FOR EACH ROW`, `WHEN (NEW.kind = 'affidavit' AND OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL)`. |

## What the trigger does

For every paper that is an affidavit, live (`voided_at IS NULL`), `sent` and tied to the voided filing:

- **It carries an approval** (`approved_at` set): `status` goes to `approved`. `approved_at`, `approved_by`, `approval_mode` and the spoken word's note are left as they were.
- **Nobody approved it**: `status` goes to `drafted`.
- **Either way** `sent_filing_id` and `sent_at` are cleared.
- **A newer live affidavit paper is already on the job**: `job_lien_desk_items_live_uniq` allows one live paper per job and kind, so the old paper is set aside (`voided_at`) with its tie kept, and the newer one stands.

It acts on a void, not on rows as they stand. On 2026-11-18 prod had no live paper that was sent and tied to a voided filing (16 affidavit papers, 11 sent, each tied to a live filing), so nothing old moves on the push.

## What the guard's new block allows

For an affidavit paper, a move from `sent` to `approved` is not a new approval when all of these hold:

- the paper carried an approval before the move (`OLD.approved_at IS NOT NULL`);
- the move leaves `approved_at`, `approved_by` and `approval_mode` exactly as they were;
- the filing the paper was tied to (`OLD.sent_filing_id`) is voided.

Then the approval checks are skipped: the role of the caller, the spoken word's note, the standing rule's first notice. Everything else in the guard runs as before.

So the trigger's move passes under any office sign-in, including an assistant's on a paper the leader approved with his own press, which the guard refused until now. The same move made by hand passes too, and is the repair for a paper tied to a filing that was voided before this shipped.

## What does not change

- A `sent` paper whose filing is live cannot be moved to `approved` by the office. That is still a new approval.
- A move that changes who approved, when or how is still a new approval.
- A § 53.056 notice's filing moves nothing. The trigger and the guard's block are for kind `affidavit`. Since [`20261119050000`](./20261119050000_lien_void_puts_notice_back.md) a notice is put back too.
- A void of a filing with no paper tied to it, and a second write of `voided_at` on a filing already voided, move nothing.
- No policy changes. The void is still one UPDATE of `job_lien_filings` under that table's update policy. The paper's move is made by the trigger as its owner.
- A paper the leader was holding when the lien was recorded goes back to `approved`, not to his hold: the status before `sent` is not stored.

## Order

Either order is safe. The client names nothing this file creates. Before the push a void behaves as before and the client says the paper still reads as filed. After the push the paper moves and the same client says so.

## Locks

`CREATE OR REPLACE FUNCTION` twice, then `DROP TRIGGER IF EXISTS` and `CREATE TRIGGER` on `job_lien_filings`, a small table. The file starts with `SET lock_timeout = '3s'`. Idempotent: a second run replaces the functions and makes the trigger again.

## Bed

`npm run test:pg:lien-void-paper` (`supabase/tests/lien_void_paper/`, in `scripts/sql-beds.txt`): the whole schema, then this file a second time. The scenario makes the office's own writes under its own sign-in and RLS, in one transaction that rolls back.

- **The leader's paper.** An assistant records and voids. The paper is approved again, by him, on his day, with no tie and no sent day.
- **His spoken word.** The note and who wrote it down stand.
- **Never approved.** Back to the office's draft.
- **A newer paper on the job.** The old one is set aside, the newer one is untouched.
- **What moves nothing.** A notice's filing, a filed lien with no paper, a second void.
- **By hand.** With a live filing the office is refused (42501). A draft cannot be approved in the leader's name. A move back in another name or on another day is refused. A move back with the approval untouched is allowed.
- **Again.** The lien is recorded a second time, the paper is sent and tied to the second filing, and a void puts it back once more.
- **As shipped.** Nobody may call the trigger's function, and the trigger is on.

No Postgres or Docker on the machine that wrote it, so the bed ran on GitHub before the PR was opened, alone on two throwaway branches (since deleted). SQL beds run 44466627243, with the migration, passed with all 40 `ok:` lines. Run 44466631093, with the migration emptied, failed on the fifth assertion with the paper still `sent` and tied.

**Applied** to prod by 2026-11-20: the dev seat's `check_migration_ledger` read 1,410 versions applied against 1,410 local files, this version among them (read in the docs pass after #8832); no change to `database.ts`, since both are trigger functions.
