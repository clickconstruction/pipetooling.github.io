---
name: "GC mode, Owner Billing O9: the money team reads the trades' money"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (PR 12, O9, after O8c)
status: planned 2026-10-09 by Helper 5 at the lead's ask (option (a), the read half of Building's door, now) · co-signs owed before the cut: gc 10 for Building's four tables, and the Board's and the Portal's lanes for gc_sows / gc_sow_lines and gc_back_charges · nothing built · the SQL block below is the migration byte for byte but for the version and the stamp, both claimed at the cut
---

# O9: the money team reads the trades' money

## The gap (live since U6b, #5236, merged 01:35 UTC 2026-10-10)

Money and Bill the customer are the money team's since the Owner Billing door: dev, the leaders (master_technician)
and the controller (`gc_money_team()`, `canSeeGcMoney`). They read each trade's work from its statement of work and its
draws. But those rows are a dev's alone:

| Table | Lane | Policy today | What Owner Billing reads from it |
|---|---|---|---|
| `gc_sows` | Board (B6-a) | `gc_sows_dev`, FOR ALL, `is_dev()` | Whether a trade's statement of work is signed, its price (`sowOf` in `boardRows.ts`) |
| `gc_sow_lines` | Board (B6-a) | `gc_sow_lines_dev` | Each line's amount; a change order's line |
| `gc_draws` | Building (U6a) | `gc_draws_dev` | The newest draw's stored materials on the bill; each draw's net in Money's job cash (`projectCash`) |
| `gc_draw_lines` | Building (U6a) | `gc_draw_lines_dev` | The lines a draw claims and stored |
| `gc_sow_line_reports` | Building (U6a) | `gc_sow_line_reports_dev` | Each line's reported percent: what the bill bills a trade at (`ownerPayApp`) |
| `gc_change_order_trade_sends` | Building (U6a) | `gc_change_order_trade_sends_dev` | A signed change at the trade's reported percent (`changeOrderTradePct`) |
| `gc_back_charges` | Portal (P4a) | dev only (`PORTAL_OPENS`) | A draw's net less the back-charges taken off it (`drawRows`' `drawOf`), which Money's job cash reads |

And `GcProjects`' `loadDraws` returns `NO_DRAWS` unless `canUseGcBuilding`, which is `['dev']`.

**So today a leader's or the controller's bill drafts every trade as "Their statement of work is not signed yet" at
$0**, while a dev's draft of the same month bills their work. A controller pressing **Send** would file and email a
pay application with the trades' work left out. Money's job cash would read the trades as paid nothing. Only test
projects exist, so nothing on prod is wrong yet.

**Back-charges: yes, they are in.** Bill the customer itself never reads them. But Money's job cash reads each draw's
net, which `drawOf` takes the back-charges off. Without them a controller's Money would show a trade paid more than a
dev's does.

## The fix: the read half of the doors, now

The audience is the one `doors.ts` already names for Building's money tables: "Building's door, to the money roles: dev,
the leaders and the controller (BUILDING_REAL_BUILD.md decision 4)". So nothing new is decided about who; this opens
**reading** early and leaves **writing** where it is.

1. **One migration**: a `FOR SELECT` policy `<table>_money_read` for `gc_money_team()` on the seven tables. The dev
   policies stay, so dev keeps every verb. No table, function or grant changes. Authenticated already holds SELECT on
   each table; RLS was the only wall.
2. **The page**: `loadDraws` reads when `canUseGcBuilding(role) || canSeeGcMoney(role)`. The board's own read of
   `gc_sows` and `gc_sow_lines` (`loadGcBoardRows`) needs no change, since it reads whatever RLS lets through.
3. **Writes stay a dev's**:
   - the Draws window and its presses (`canUseGcBuilding && canSeeGcMoney`, so dev only) are unchanged;
   - every draws RPC still writes through the dev policies, so a controller's `gc_approve_draw` is still refused;
   - **the statement of work card** (`GcTradeSow`) shows to the whole office team once its row can be read, and its
     **Send to their portal to sign** writes `gc_sows` directly, which a controller cannot. So O9 shows the card read
     only to anyone who cannot write it: the press is for a dev (`canUseGcBoardWrites`, a new name for today's
     dev-only award audience) until the award door (the owner's call W) widens it. That is a one-line gate in the
     Board's component, named here so the Board's lane co-signs it.
4. **`doors.ts` learns a reader beside the door**: `GcTableDoor` gains `reads?: GcDoor`, the team a table's `FOR SELECT`
   policies let read beyond its door. The seven tables keep their door (`dev`) and gain `reads: 'money'`.
   `doors.test.ts` reads the door from the non-SELECT policies and `reads` from the SELECT ones, and fails when either
   is not what the list says.

## What a person sees

- **A leader or the controller**, on Bill the customer: the same draft a dev sees. Each trade's line bills its
  reported work, a signed change bills at the trade's percent, and stored materials come from the newest draw. Money's
  job cash shows the same paid, approved, asked and held per trade as a dev's.
- **On the board**, a leader or the controller now sees each trade's statement of work card (signed, waiting on their
  signature, drafted) as a dev does, read only.
- **Nobody else** sees anything new: an estimator or an assistant reads none of the seven tables.

## The SQL (byte for byte at the cut, but for the version and the stamp)

```sql
SET lock_timeout = '3s';

-- GC mode, Owner Billing's O9 (v2.NNNN): the money team reads the trades' money. Money and Bill the customer are the
-- money team's (gc_money_team(): dev, the leaders and the controller) since the Owner Billing door, but each trade's
-- statement of work and its draws were a dev's alone, so a leader's or the controller's bill drafted every trade at $0
-- (live since U6b, the Draws window). This opens reading, and only reading, to the audience doors.ts already names for
-- Building's money tables (BUILDING_REAL_BUILD.md decision 4): a FOR SELECT policy for gc_money_team() on the Board's
-- gc_sows and gc_sow_lines, Building's gc_draws, gc_draw_lines, gc_sow_line_reports and gc_change_order_trade_sends, and
-- the Portal's gc_back_charges, whose taken charges every draw's net reads. Each table keeps its dev policy, so writing
-- stays a dev's: the Draws window, the draws RPCs and the statement of work's presses. No table, function or grant
-- changes; authenticated already holds SELECT on each.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_sows', 'gc_sow_lines', 'gc_draws', 'gc_draw_lines', 'gc_sow_line_reports', 'gc_change_order_trade_sends',
    'gc_back_charges'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_money_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.gc_money_team()))',
      t || '_money_read', t);
  END LOOP;
END $$;
```

`CREATE POLICY` takes a brief lock on each of the seven tables. They are barely used, and `lock_timeout` fails the
push fast if one is busy. The read-only and twin fences already on these tables limit writes only, so a training
account on the money team reads and writes nothing.

## The bed: `supabase/tests/gc_owner_billing/92_money_reads.sql`

The fixture is made as postgres, the shape `gc_building/60_draws.sql` uses: a job being built with one awarded trade,
its signed statement of work with two lines, a change order sent to the trade, two draws with their lines and
reports, and a back-charge taken off one draw. Then, through RLS:

- **The shape**: each table has its `<table>_money_read` policy, `SELECT` for `authenticated`, beside its dev policy,
  which is unchanged.
- **The controller and a leader read what a dev reads**: on each of the seven tables, the count and an `md5` of the
  rows (`row_to_json` in id order) are equal for the controller, a master and a dev.
- **The controller writes none**: on each table an `INSERT` is refused, and an `UPDATE` and a `DELETE` reach 0 rows.
  `gc_approve_draw` and `gc_send_trade_change` refuse the controller with nothing written.
- **A dev still writes**: `gc_approve_draw` on the fixture's draw goes through.
- **An estimator and an assistant read none**: 0 rows on each table.
- **A training account on the money team** reads but writes none, held by the fences.
- **A digital twin** reads only by its role, and writes none.

**Five mutants**, each to be caught:
1. the policy `FOR ALL` instead of `FOR SELECT` (the controller's writes would land);
2. `gc_office_team()` instead of `gc_money_team()` (the estimator would read);
3. `gc_back_charges` left out of the list (the controller's row count on it differs from a dev's);
4. `USING (true)` (anyone signed in would read);
5. the policy named `t || '_dev'` (it would replace the dev policy, and a dev's `gc_approve_draw` would fail).

## The code and its tests

- `src/pages/GcProjects.tsx`: the gate on `loadDraws` and its comment. The Draws button and window are unchanged.
- `src/components/gc/GcTradeSow.tsx`: **Send to their portal to sign** for those who can write it; a read-only card for
  everyone else.
- `src/lib/gc/access.ts`: `canUseGcBoardWrites` (today `['dev']`), held to the award door's audience.
- `src/lib/gc/doors.ts` and `doors.test.ts`: the `reads` field and its check.
- Tests:
  - `GcProjects.render.test.tsx`: a controller's page loads the draws (`loadGcDraws` is called), and its Bill the
    customer bills the trade's reported work;
  - `GcTradeSow` render: a controller sees the card without the press;
  - `doors.test.ts`: the seven read `money` and keep door `dev`.

## Docs

- `docs/migrations/<stamp>_gc_money_reads_trades.md`, with its verify steps (read only, as the controller in
  `BEGIN … ROLLBACK`).
- `ACCESS_CONTROL.md`: the Owner Billing door paragraph, and Building's, the Board's and the Portal's lines for the
  seven tables (read by the money team since O9).
- `BILLING_FLOWS.md`: one sentence, that the money team's bill reads the trades' work.
- `BUILDING_REAL_BUILD.md`'s door and `PORTAL_REAL_BUILD.md`'s: the read half is open, and writing waits on each door.
- The release note and the fragment.

## The calls this adds

1. **The statement of work card for the leaders and the controller**: read only until the award door (call W).
   Default yes, since they can then see what the bill bills. The other way hides the card from them, and the bill
   still reads.
2. **`gc_back_charges` read by the money team ahead of the Portal's trade wave.** Default yes, since Money's job cash
   is wrong without it. The Portal lane co-signs.
3. **The board's other Building reads** (the daily log, submittals, RFIs) stay a dev's. Owner Billing reads none of
   them.

## Is this the best we can do?

It closes the wrong answer with the smallest change: read policies on tables whose eventual audience is already
written down, no new door and no write opened. It could be better three ways:

1. **One read path for money.** A security-barrier view per trade (`gc_trade_money`) could carry exactly what Owner
   Billing needs, so the money team never reads the raw tables. Not taken: the kernels read the rows' shapes as they
   are, and a view would be a second mapper.
2. **Send refuses a short read.** Bill the customer could refuse **Send** whenever its reader cannot see a trade's
   statement of work. That would guard any future gap the same way. Worth adding with Building's door, as a check
   that costs one comparison.
3. **The doors in one place.** The `reads` field makes `doors.ts` say who reads beside who writes. A later pass could
   draw the whole GC door map from it for `ACCESS_CONTROL.md`, so the paragraph never drifts.
