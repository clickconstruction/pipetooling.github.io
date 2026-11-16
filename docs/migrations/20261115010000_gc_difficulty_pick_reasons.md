# 20261115010000_gc_difficulty_pick_reasons.sql (2026-11-15, v2.7296)

GC difficulty rating, PR 3 of six (punch list #357, [`to-dos/gc-difficulty-rating/README.md`](../../to-dos/gc-difficulty-rating/README.md)): the Paying scale read from the bills.

- **`gc_difficulty_ratings.pick_reasons`** jsonb `{key: words}`, default `{}`, checked an object (`NOT VALID` then validated, so the lock is short): what a bills scale's point rests on — *Read from their bills: …* with the numbers behind it, or *By hand: …* with the person's reason.
- **The guard** (`gc_difficulty_ratings_guard`, replaced): as before (who and when, a published version, every pick on a scale and a rung the version has, no update), plus a pick on a `bills` scale needs non-empty words in `pick_reasons`, and words name a pick that is there.
- No table created, so no fence calls; no policy changes.

**Apply order**: push right after the merge. The client of this PR reads `pick_reasons` by name and writes it on every save; before the push a save that carries a Paying point is refused by PostgREST for the missing column and the card shows the reason, while a save with no Paying point (fewer than three bills) still lands. Regenerate types after the push as a `chore(types)` PR.

**Applied** to prod by 2026-11-16: `npm run check:migration-drift` read 1326 local files against 1326 applied, this version among them (run in the docs pass after #8111); `database.ts` on `main` carries `pick_reasons`.
