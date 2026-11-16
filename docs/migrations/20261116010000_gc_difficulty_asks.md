# 20261116010000_gc_difficulty_asks.sql (2026-11-15, v2.7358)

GC difficulty rating, PR 5 of six (punch list #357, [`to-dos/gc-difficulty-rating/README.md`](../../to-dos/gc-difficulty-rating/README.md)): the ask at the end of a job.

- **`gc_difficulty_asks`** — one row per job and person once the ask is settled: `job_id`, `customer_id` (the GC the job asked about), `asked_user_id` (defaults to `auth.uid()`), `answered_rating_id` (the rating saved from the ask; `ON DELETE SET NULL`), `dismissed_at` (*Not now*), unique on `(job_id, asked_user_id)`. A job with a row never asks that person again. No row is written when a job closes.
- **`gc_difficulty_open_asks()`** — `SECURITY INVOKER`, `STABLE`: what is open for the caller. Jobs they are the master on (`jobs_ledger.master_user_id`), whose first move to Ready to bill in `job_status_events` is on or after 2026-11-15 (the day the ask began, so no old job asks), with a GC on the job (`gc_customer_id` set, a commercial customer, or a job from a bid: the rule the GC's card uses), that GC not rated since the job closed, and no row in `gc_difficulty_asks`. At most 50, newest first. A dev is also asked about customers named `ZZ …`, so the ask can be walked on the live site without touching a real job. Derived from the events the status RPC already logs: no new trigger on `jobs_ledger`.
- **The gates**: a person reads and inserts their own rows; `is_office_staff()` reads all; `is_dev()` deletes (a walk's rows). No update: an ask is settled once.
- The four fence calls.

Read-only on prod before the PR, as the owner's account would run it without the asks table: 0 open (the start day is today), and `authenticated` holds SELECT on the four tables the body reads. About 22 GC jobs a month reach Ready to bill, so the screens fold the asks by GC.

**Apply order**: push right after the merge. The client reads `gc_difficulty_open_asks()` and fails soft: until the push a master sees no ask, and nothing else changes. Regenerate types after the push as a `chore(types)` PR.

**Applied** to prod by 2026-11-16: `npm run check:migration-drift` read 1326 local files against 1326 applied, this version among them (run in the docs pass after #8111); `database.ts` on `main` carries `gc_difficulty_asks`, `gc_difficulty_open_asks`.
