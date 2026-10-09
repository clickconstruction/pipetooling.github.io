# 20261010005000_gc_submittal_writes.sql (2026-10-09, v2.5037)

GC mode, the real build, the Building lane's U4a: the submittal register's presses (`to-dos/gc-mode/mockups/building-u4.md` on branch `spike/gc-mode`). Six functions, no table. The tables are `20261008030000_gc_building_records`; the award they read is `20261009140000_gc_award_and_sow` (the Board's B6-a).

- **`gc_submittal_move(p_submittal_id uuid)`** returns whose move a submittal is, from its newest round, as the prototype's `submittalState` reads it: `trade`, `us`, `architect` or `approved`. A submittal with no round is the trade's. The five below read it.
- **`gc_add_submittal(s jsonb)`** returns the new submittal's id. It takes the prototype's `addSubmittal` shape: `packageId`, `title`, `kind`, `specSection`, `lineIds` (the trade's scope lines it holds), `leadDays` and `neededBy`. It numbers the submittal by its spec section, `03 21 00-02`, or plainly by the register's count, `003`, as `nextSubmittalNumber` does. One press at a time on a job takes a number, and a number a removed submittal left is skipped rather than taken twice.
- **`gc_submittal_came_in(r jsonb)`** returns the round's id: a round that came by email, `submittalId`, `file`, `driveUrl` and `note`, recorded by the office while it is the trade's move (decision 6).
- **`gc_send_submittal_to_architect(p_submittal_id uuid, p_email_send_log_id uuid DEFAULT NULL)`** returns the day: the newest round went to the architect today. `gc-architect-email` (U4b) passes the email it sent; no email means we sent it another way. Only while it is ours.
- **`gc_answer_submittal(p_submittal_id uuid, p_answer text, p_note text DEFAULT '')`** returns the day: approved, approved as noted, or revise with what to change, which makes it the trade's move again. Only while it is with the architect.
- **`gc_trade_submittal_send(p_company_id uuid, p_submittal_id uuid, p_file_name text, p_drive_url text DEFAULT NULL, p_note text DEFAULT '')`** returns the round's id: the trade's round from its portal, for the company the trade is awarded to, while it is the trade's move. It refuses with keys, as the Portal's P2a verbs do: `notFound`, `notYours`, `notYourMove` and `fileNeeded`, each with its reason as the DETAIL. The Portal's P5 adds the kind to `submit-gc-trade-portal` and the words for the two new keys.
- **They refuse**, in words: a training account and a digital twin; our own crew's trade; a trade not awarded; a blank title; a kind the register does not know; a hold on another trade's work; a round, a send or an answer out of turn; and revise with nothing to change.
- **The last submittal a trade owed keeps its promise to send them**: `gc_keep_promises(company, 'submittals', job, trade, today)`, whether the trade sent it or the office recorded it (decision 9).

`SECURITY INVOKER`, every one: the tables' dev policies decide who may. The office's presses and `gc_submittal_move` are revoked from `PUBLIC` and `anon` and granted to `authenticated`; `gc_submittal_move` and the trade's verb are granted to `service_role`, and the trade's verb to nobody else.

Apply order: after `20261009140000` (the award column `gc_trade_packages.awarded_invite_id`) and `20261008030000`. It is `CREATE OR REPLACE`, idempotent, and locks no table.

**Before the push**, the SQL bed (`scripts/pgtest-gc-building.sh`, `npm run test:pg:gc-building`; GitHub's runners run it from `.github/workflows/sql-beds.yml` on this PR, since no session here reaches Docker) applies every migration to the Supabase Postgres image, applies Building's presses a second time, and plays `supabase/tests/gc_building/40_submittals.sql` in one transaction that rolls back. It adds three submittals and walks one through a revise, as a dev, and sends two rounds as the trade's company through the service role. It refuses each case above in its words, keeps the trade's promise on the last round it owed, and skips a number a removed submittal left. A trainee and a twin are refused by name, an estimator by RLS, and a signed-in caller cannot run the trade's verb. It ends `gc_building PASSED`.

## Verify after the push

1. **The six functions are there, with invoker's rights, and only the right callers run them.**

   ```sql
   SELECT p.proname, p.prosecdef AS definer,
     has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can,
     has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_can,
     has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_can
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname IN ('gc_submittal_move', 'gc_add_submittal', 'gc_submittal_came_in', 'gc_send_submittal_to_architect', 'gc_answer_submittal', 'gc_trade_submittal_send')
   ORDER BY p.proname;
   ```

   Expect six rows, every `definer` false and every `anon_can` false. `signed_in_can` is true on all but `gc_trade_submittal_send`. `service_can` is true on `gc_submittal_move` and `gc_trade_submittal_send`.

2. **Its refusals before any row, as a dev**, through the page's `supabase` client:
   - a trade id that matches nothing: *No trade with that id.*
   - Plumbing on "GC test project, delete me" (`ef8905d1-039a-4cbc-9d69-9468cfea50e0`, our own crew): *Our own crew sends no submittals.*
   - a trade on that job with no award: *This trade is not awarded yet. Its submittals start once it is.*

3. **One submittal on "GC test project, delete me"**, on the trade B6-a's verify awarded:
   - Add it with a spec section and one of the trade's scope lines. It reads back numbered `<section>-01`, holding that line, the trade's move.
   - Record a round that came by email, with a file name and a Drive link. It is ours now.
   - Mark it sent another way: `gc_send_submittal_to_architect(<id>)` with no email. The email itself is U4b's, on Grace's yes.
   - Record *revise* with a note. It is the trade's move again, and a second round can come in.
   - The rows stay with the test project's others for the owner's call 4, and their ids go to the lead's list.

4. **A training account's call is refused in words.** As the training-mode user (`20261008030000`'s step 3 shows how), `gc_add_submittal` gives *A training account cannot add a submittal.* (`42501`), before any row is written.

5. **The trade's verb is the service role's only.** As a dev, `gc_trade_submittal_send` gives *permission denied for function gc_trade_submittal_send*.

## Rollback

```sql
DROP FUNCTION IF EXISTS public.gc_trade_submittal_send(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.gc_answer_submittal(uuid, text, text);
DROP FUNCTION IF EXISTS public.gc_send_submittal_to_architect(uuid, uuid);
DROP FUNCTION IF EXISTS public.gc_submittal_came_in(jsonb);
DROP FUNCTION IF EXISTS public.gc_add_submittal(jsonb);
DROP FUNCTION IF EXISTS public.gc_submittal_move(uuid);
```

No screen calls them until U4b, so nothing else changes.

## Status

Written for the Building lane's U4a; not applied. The lead pushes it after the merge and records here what steps 1 to 5 said.

**Applied to prod 2026-10-09 at 10:53 UTC** by the lead (GC MODE) from a clean checkout at main's tip (db7a2853a) with `scripts/db-push.sh` (`--include-all`, since 006000 was applied first); drift 820/820 after. Verified the same hour through the management API, every write rolled back:
- Step 1: six functions, every one SECURITY INVOKER and closed to `anon`; `gc_trade_submittal_send` closed to the signed in and open to the service role.
- Step 2, as a dev: *No trade with that id.*, *Our own crew sends no submittals.* (Plumbing on the test project), *This trade is not awarded yet. Its submittals start once it is.* (the Concrete trade).
- Step 3, inside one rolled-back transaction, the award drafted first (`gc_award` on ask `115b6971`, the $12,500 quote): the submittal read back `03 30 00-01` holding one scope line, the trade's move; a round that came in by email (file and Drive link) made it ours; *sent another way* put it with the architect; *revise* with a note made it the trade's move again, one round kept. Nothing was kept on prod (0 submittals, 0 statements of work after); the kept rows the doc describes wait on Grace's yes in Helper 18's chat.
- Step 4: the training-mode user's call gave *A training account cannot add a submittal.* (`42501`).
- Step 5: as a dev, `gc_trade_submittal_send` gave *permission denied for function gc_trade_submittal_send*.

The types PR follows with 006000's (Helper 17, after PUNCHLIST's #5111).
