# 20261007060000_bids_cover_letter_texts.sql (2026-10-06, v2.4737)

Bid history PR 0a (punch list #73, [`to-dos/bid-history`](../../to-dos/bid-history/README.md)): the Cover Letter's three per-bid boxes are saved.

- Three nullable text columns on `bids`: `cover_letter_inclusions`, `cover_letter_exclusions`, `cover_letter_terms`. Null means nobody typed in the box for this bid (the letter falls back to the org default, then the built-in wording, as before); a string, even an empty one, is what was typed.
- Bid history keeps them: `bid_changes_bid_columns()` is redefined whole with the three added, and the `bids` trigger's `UPDATE OF` list is rebuilt from it with `CREATE OR REPLACE TRIGGER`, so a change to any of the three is recorded.

Additive; no policy change. `ALTER TABLE bids ADD COLUMN` takes a brief ACCESS EXCLUSIVE lock on `bids` under the 3-second timeout; the trigger swap is a catalog write. Apply order: **client first or with the merge** — the old client never names the columns; the new client's read of them on a database that lacks them fails quietly (the boxes then behave as before, unsaved) and its write would fail with a toast, so push promptly after the merge. Regenerate `src/types/database.ts` after the push (the three columns are hand-added until then).

Test: `bidChangesCapture.test.ts` holds the column list against the types; `BidsCoverLetterTab.letterTexts.render.test.tsx` covers the seed on open and the write after typing.
