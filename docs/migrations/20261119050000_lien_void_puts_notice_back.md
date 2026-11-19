# 20261119050000_lien_void_puts_notice_back.sql (2026-11-19, v2.7911)

Voiding a § 53.056 notice's record puts the notice back on the Lien desk, in the same transaction as the void, as [`20261119020000`](./20261119020000_lien_void_puts_paper_back.md) does for a filed affidavit. It ships with the client that says where the notice went ([v2.7911](../recent-features/v2.7911.md)).

A notice's record voided left its paper `sent` and tied to the voided record. While the month was open the desk asked for a new draft, a new approval and a new signature. Once the month had closed the job stood under *Sent* for thirty days with no notice on record. The attorney's letter clock reads the paper's sent day and never the record, so it came due on a notice that was not on record.

No table changes. The same two functions and the same trigger, restated by script from `20261119020000`.

| Object | What changed |
|---|---|
| `job_lien_desk_items_guard()` | The block that reads a move from `sent` back to `approved` as no new approval loses its `NEW.kind = 'affidavit'` test, and its comment says so. Nothing else: the two bodies diff to those lines. |
| `job_lien_filing_void_restores_paper()` | It moves the papers of the voided record's own kind (`i.kind = NEW.kind`) in place of affidavits alone, and a newer live paper sets the old one aside only when it is of that kind (`x.kind = v_item.kind`). Three lines differ. |
| Trigger `job_lien_filing_void_restores_paper` on `job_lien_filings` | `WHEN (NEW.kind IN ('affidavit', 'notice_53_056') AND OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL)`. Dropped and made again. |

## What it does to a notice

For every notice paper that is live, `sent` and tied to the voided record:

- **It carries an approval:** `status` goes to `approved`. The approval, the spoken word's note, the signature, the printed mark, the months and the fields are left as they were. So a printed notice stands in *Approved · to mail* again.
- **Nobody approved it** (recorded as already sent from a draft): `status` goes to `drafted`.
- **Either way** `sent_filing_id` and `sent_at` are cleared. With no sent day, the attorney's letter clock has nothing to count.
- **A newer live notice paper is already on the job:** the old one is set aside (`voided_at`) and the newer one stands.

## What does not change

- An affidavit is put back as `20261119020000` put it back. The bed runs every assertion of that file again.
- A paper of another kind on the job no longer matters to the set-aside test: a notice draft beside a lien does not set the lien's paper aside.
- A `sent` paper whose record is live cannot be moved to `approved` by the office, for a notice as for a lien.
- **Undo** on a record that applies a paper already on record (v2.7508, `undoLienNoticeApply`) is untouched. That paper was set aside with `voided_at`, never `sent`, so nothing here matches it.
- A retainage notice and a release of record have no paper on the desk. The trigger does not fire for them.
- A void calls back nothing a recorded mailing did outside the desk: an emailed copy, an enclosed release, a pay offer, the job's History line.
- No policy changes.

Nothing old moves. On 2026-11-19 prod had 25 notice records, 4 voided, and 17 sent notice papers, none tied to a voided record. The trigger acts on a void, not on rows as they stand.

## Order

Either order is safe. The client names nothing this file creates. Before the push a notice's void behaves as before and the client says the notice still reads as sent.

## Locks

`CREATE OR REPLACE FUNCTION` twice, then `DROP TRIGGER IF EXISTS` and `CREATE TRIGGER` on `job_lien_filings`. The file starts with `SET lock_timeout = '3s'`. Idempotent.

## Bed

`npm run test:pg:lien-void-paper`, grown from 40 to 55 assertions. The runner applies every migration, then `20261119020000` a second time and this file a second time after it. The first file's second run puts the affidavit-only functions back, so the bed proves this file widens them again and ends on what prod runs.

- **A signed, printed notice.** The office voids its record. It is approved again, by the leader, on his day, signed and printed as it was, with no tie and no sent day.
- **His spoken word.** The note and who wrote it down stand.
- **Never approved.** Back to the office's draft.
- **A newer notice on the job.** The old one is set aside, the newer one is untouched.
- **Another kind on the job.** A lien's paper is approved again beside a notice draft.
- **By hand.** With a live record the office is refused (42501).

No Postgres or Docker on the machine that wrote it, so the bed ran on GitHub before the PR was opened, alone on two throwaway branches (since deleted). SQL beds run 44489667929, with both migrations, passed with all 55 `ok:` lines. Run 44489673323, with this file emptied, failed on the first notice assertion: the paper read *sent*, tied, with its sent day, where approved was wanted.
