# 20261114110000_gc_difficulty_ratings.sql (2026-11-14, v2.7279)

GC difficulty rating, PR 2 of six (punch list #357, [`to-dos/gc-difficulty-rating/README.md`](../../to-dos/gc-difficulty-rating/README.md)): the rating itself.

- **`gc_difficulty_ratings`** — `customer_id` (cascade), `criteria_version_id` (→ `difficulty_criteria_versions`), `picks` jsonb `{key: points}`, `note` (required, 1 to 1000 characters), `rated_by` / `rated_by_name` / `rated_at`. The newest per customer stands and every one is kept; an index on `(customer_id, rated_at desc)`.
- **The guard** (`gc_difficulty_ratings_guard`, before insert and update): stamps who and when from `auth.uid()`; refuses an update in a sentence (a rating is written once); refuses a version that is not published; refuses a pick on a scale the version does not have, or on points none of its rungs give (a bills scale with no rungs takes 0 to its max).
- **Policies**: every signed-in user reads (the chips on the Bid Board and the Workbench, the card); `is_office_staff()` (dev, master, assistant, controller) inserts, until the Bid Board's price list says who may rate (PR 4); `is_dev()` deletes. No update policy. Anon revoked.
- Ends with the four fence calls.

**Apply order**: push right after the merge. Until then the card and the chips read the table's refusal as "nothing" (the chip hook swallows a failed read; the card shows the reason with *Try again*). Regenerate types after the push as a `chore(types)` PR; `gcDifficultyRatingIo.ts` reads the table by name (`as never`) until then.
