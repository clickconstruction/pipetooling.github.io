# 20261114090000_difficulty_criteria_versions.sql (2026-11-14, v2.7275)

GC difficulty rating, PR 1 of six (punch list #357, [`to-dos/gc-difficulty-rating/README.md`](../../to-dos/gc-difficulty-rating/README.md)): the criteria a GC is rated on, versioned.

- **`difficulty_criteria_versions`** — one row per version: `version` (0 on a draft), `status` (`draft` or `published`), `body` jsonb (`{scales:[{key, name, scope: gc|bid, source: picked|bills, max, rungs:[{points, sentence}]}]}`), `note`, `published_by` / `published_by_name` / `published_at`, the created and updated stamps. One draft at a time and one row per published number (two partial unique indexes). The database holds the floor on the body (an object with a `scales` array); the client's kernel `src/lib/bids/difficultyCriteria.ts` validates the rest before a publish.
- **The guard** (`difficulty_criteria_versions_guard`, before insert, update and delete): a draft's version is 0 and its publish stamps are empty; publishing takes `max(version) + 1` under an advisory lock and stamps who and when from `auth.uid()`; an update or a delete of a published row is refused in a sentence (ratings and priced bids pin to it); a signed-in writer cannot insert a published row (save the draft, then publish).
- **Policies**: every signed-in user reads (the GC's card, the Workbench and the master's sheet read the published version in PR 2 to 5); `is_dev()` inserts, updates and deletes. Anon revoked.
- **Seed**: version 1, published by *the app*, with the three scales of 2026-11-14: `paying` (bills, gc, 0 to 1), `field` (picked, gc, 0 to 3), `office` (picked, gc, 0 to 2). `difficultyCriteria.test.ts` reads this file and holds the JSON equal to the kernel's `DIFFICULTY_CRITERIA_V1`. `ON CONFLICT (version) WHERE status = 'published' DO NOTHING`, so the file is safe to push twice.
- Ends with the four fence calls.

**Apply order**: push right after the merge. The only reader is the dev's Settings card, which shows the read's refusal and a *Try again* until the table is there; nothing else calls it. Regenerate types after the push (`npm run gen-types:linked`) as a `chore(types)` PR; `difficultyCriteriaIo.ts` reads the table by name (`as never`) until then.

**Applied** to prod by 2026-11-16: `npm run check:migration-drift` read 1326 local files against 1326 applied, this version among them (run in the docs pass after #8111); `database.ts` on `main` carries `difficulty_criteria_versions`.
