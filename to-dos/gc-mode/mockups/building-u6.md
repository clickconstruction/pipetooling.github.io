---
name: "Building U6: the trades' draws and pay applications"
rows: BUILDING_REAL_BUILD.md, The PRs in order, 6; decisions 3, 4, 5, 9 and 12; The tables (U6); Writing it (the trades' writes, U6's office writes); the owner's calls, 5; PORTAL_REAL_BUILD.md (P5a, P5c, the 37 trade actions); mockups/portal-p2c.md
branch: the plan on spike/building-u6-plan (from origin/spike/gc-mode at d4e4efca5); U6a from origin/main once this plan merges, pushed on its merge; U6b on U6a's types; U6c and U6d after
status: plan 2026-10-09 by Helper 18 at the lead's ask. The read-back was approved the same day at all seven picks. U6a's SQL below ran green on main's real GC migration chain in PGlite (99 assertions; ten planted bugs each failed it; U4a's and U5a's scenarios still passed beside it). U6c's SQL follows in its own amendment. Nothing is cut or claimed. Amendment 1, the same day: the comment on gc_sow_lines.change_order_id that says the kernels' line id (Helper 13), and seq on the draws and the reports, so the newest report and a resend's place never hang on the clock (a same-millisecond tie made the bed flaky once); the bed ran green three times after it. Amendment 2, the same day: U6c's SQL in full (closeout: 70_closeout.sql, 46 assertions, green beside U6a's 99; ten planted bugs each failed it), the kernel's line 7 fix, and U6d's window. Amendment 3, the same day: gc_trade_change_signed_in, the office's twin of the trade's change signature (the lead's call), and Helper 15's progress-bill case; 70_closeout.sql 53 assertions, three runs green, fourteen planted bugs each failed.
---

# Building U6: the trades' draws and pay applications

## What it is

The trades' money on real data: what each trade reports on the lines of its signed statement of work, the pay
applications it sends with their G702 and G703, what we approve, hold and pay, the back-charges we take off, the
signed change orders that become lines of its statement of work, and closeout.

Four PRs, at the SQL and screen seams (call 1):
- **U6a, the money's presses** (one migration, and the kernel's one-line fix below):
  - four tables, `gc_draws`, `gc_draw_lines`, `gc_sow_line_reports` and `gc_change_order_trade_sends`;
  - `taken_draw_id`'s foreign key on P4a's `gc_back_charges`, and a change order's line allowed to be a credit;
  - eight office presses and four trade functions, with the money worked out in SQL;
  - its SQL bed scenario, `supabase/tests/gc_building/60_draws.sql`, and its migration doc;
  - the types PR follows the lead's push.
- **U6b, the Draws window** (no migration): ported from the prototype's `GcDrawsTab`, with the mapper and the io.
- **U6c, closeout's presses** (one migration): the final pay application, the retainage release, accepting the work
  and closing the job. Its SQL comes in an amendment to this plan.
- **U6d, the closeout window** (no migration): ported from the prototype's `GcCloseout.tsx`.

## The seven calls, as the lead picked them (2026-10-09)

1. **Four PRs** at the SQL and screen seams: U6a, U6b, U6c, U6d. The day rule is no longer one migration a day: the
   lead pushes on merge, so a second Building migration in a day is fine once it is ready and verified.
2. **The office records what came by email or on paper**: a pay application (`gc_draw_came_in`), the final one
   (U6c), and an unconditional waiver (`gc_draw_waiver_in`). New beside the prototype, as U4's came-in is. The whole
   office side walks before P5, and stays for a trade that never uses the portal.
3. **A draw's money is worked out in SQL** from what it claims, for the trade and the office alike
   (`gc_draw_money`), held equal to the kernels' `payApplication` and `drawMoney` by a parity scenario. A trade's
   numbers come from outside the company, so they are never taken from the caller. The other way, O4a's, takes the
   client's numbers and checks them.
4. **A pay application sent back stays a `gc_draws` row** (status `sent_back`, its day and note, and `we_see` on the
   lines we doubt), not a jsonb copy in a fifth table. No pay application is stored twice.
5. **No `draw_ask` and no `warranty`**: every draw is a pay application, and the warranty letter is a record the owner
   said closeout no longer asks for (2026-10-02).
6. **The live walk's signed statement of work waits for P2c**: only `gc_trade_sign_sow` signs one, from the portal.
7. **The money roles approve and pay** (the owner's call 5, the default). The owner's word comes before Building's
   door, not before U6a.

## Found in the kernel: a credit is taken again on every draw

`drawLinesOf` in `src/lib/gc/building.ts` keeps a draw's lines with `thisPeriod > 0 || stored > 0`. A change order's
credit line (its amount below none, reported 100% when the trade signs it) moves by a negative amount, so its line is
dropped from the draw that takes the credit. The next pay application finds the line still at 0% before, and takes
the credit again. Its line never reads billed, so the trade's work never reads all billed, and closeout never opens.

Main's kernel today, on the scenario's statement of work (Footings $12,000, Slab $18,000, a $2,000 credit):

| Draw | Main today | Fixed |
|---|---|---|
| 3: Footings 100%, Slab 40%, the credit | $1,000; the credit's line dropped | $1,000; the credit's line kept at 100% |
| 4: Slab 50% with $9,000 stored | $8,800, the credit taken again | $10,800 |

**The fix** (U6a, so the SQL and the kernel never disagree): keep a line whose work this period is not zero.

```ts
/** The lines a draw keeps: each whose work moved this period (a credit's too), or with materials stored. */
export function drawLinesOf(app: PayApplication): { sovId: string; toPct: number; stored?: number }[] {
  return app.lines.filter((l) => l.thisPeriod !== 0 || l.stored > 0).map((l) => ({ sovId: l.sovId, toPct: l.pct, ...(l.stored > 0 ? { stored: l.stored } : {}) }))
}
```

Its test in `building.direct.test.ts` (or wherever main's `drawLinesOf` test lives): a credit's line is kept on the
draw that takes it, and the next draw does not take it again (the two rows above). `drawApprovedLess` and the trade's
pay application read the same function, so both follow.

**One more for U6c**, settled in its amendment: `finalPayApplication`'s line 7 (`previousCertificates`) sums each
earlier draw's `net`. The prototype's `takeBackCharge` lowers a draw's `net` by the charge, so the retainage release
would pay the charge back. U6c works the release out as the retainage held (`retainageHeldNow`'s rule), and the
kernel's line 7 adds the charges back.

## The tables and the functions (U6a)

`SECURITY INVOKER`, every function, so RLS decides who may: dev only until Building's door, then the money roles
(decision 4). The trade's four are the service role's only, as the Portal's P2a verbs are.

| Table | The prototype's | What it keeps |
|---|---|---|
| `gc_draws` | `Draw`, `DrawPayApp`, `DrawSentBack` | One pay application on a statement of work: its number, day, status (requested, approved, paid, sent back), money, waiver, what was asked when approved for less, the day and note when sent back, the pay application's words, and its file and who of ours recorded it when it came by email |
| `gc_draw_lines` | `Draw.lines`, `DrawSentBack.lines` | What a draw claims on each line: its percent, the stored dollars, and on one sent back the percent we see |
| `gc_sow_line_reports` | `SovLine.pctReported` | A trade's report on a line, append only; the newest is the last made (`seq`) |
| `gc_change_order_trade_sends` | `ChangeOrder.tradeChange` | A signed change order sent to its trade, the day the trade signed it, and the line it became |

`SovLine.pctBilled` is the most an approved or paid draw took the line to, and `pctReported` the newest report.
Neither is stored on the line (decision 3).

| Press | The prototype's action | What it writes | What it refuses |
|---|---|---|---|
| `gc_draw_came_in(package, p jsonb)` | new (call 2) | A pay application that came by email or on paper, by the trade's rules, with its Drive link; its claim is their report; their payApp promise kept | A training account, a digital twin, a job not being built, a statement of work not signed, one already waiting, a line not on it, no period, no signer, nothing to pay |
| `gc_approve_draw(draw)` | `approveDraw` | Approved today | One not waiting on us, the retainage release (U6c) |
| `gc_approve_draw_less(draw, we_approve, note)` | `approveDrawLess` | Approved for less: the money again, what they asked kept | No reason, a line it does not claim, not less than asked |
| `gc_send_draw_back(draw, we_see, note)` | `sendDrawBack` | Sent back with what to fix and what we see; its resend takes the number | Nothing to fix, a line it does not claim, a percent out of range |
| `gc_pay_draw(draw)` | `payDraw` | Paid today | One not approved |
| `gc_draw_waiver_in(draw)` | new (call 2) | The unconditional waiver in; their closeout promise kept when it was the last paper owed | One not paid, one in already |
| `gc_take_back_charge(charge, draw)` | `takeBackCharge` | The charge's draw and day | A charge still in its days to answer, disputed, dropped or taken; a draw not approved, paid, on another statement of work, or paying less than the charge |
| `gc_send_trade_change(change order)` | `sendTradeChange` | Sent to the trade today | One the customer has not signed, our own work, a trade with no signed statement of work, a second send |
| `gc_trade_sow_report(company, trade, line, pct)` | `tradeReport` | The report, never below billed, and the line's real days | `notFound`, `notOnTrade`, `sowNotSigned`, `jobNotBuilding`, `badRequest`, `splitLine` |
| `gc_trade_pay_app(company, trade, app)` | `tradeSendPayApp` | The pay application, its money worked out here; its claim their report; their payApp promise kept | `notFound`, `notOnTrade`, `sowNotSigned`, `jobNotBuilding`, `drawWaiting`, `badRequest`, `nameNeeded`, `nothingToBill` |
| `gc_trade_unconditional_waiver(company, draw)` | `tradeSignUnconditional` | As `gc_draw_waiver_in` | `notFound`, `notOnTrade`, `notPaidYet`, `alreadySigned` |
| `gc_trade_sign_change(company, change order)` | `tradeSignChange` | A line of their statement of work for the change's cost; a credit reported done | `notFound`, `notOnTrade`, `alreadySigned` |

Four helpers, read-only but the last: `gc_sow_line_of` (a line by the kernels' id: its scope item, or its own id on a
change order's line), `gc_draw_claim` (a claim read into the statement of work's lines), `gc_draw_money` (the money),
and `gc_draw_waiver_signed` (the waiver and the closeout promise, shared by the office's press and the trade's).

**A draw's money** (`gc_draw_money`, the kernels' `payApplication` and `drawMoney`):
- each line goes to its claim, never below what an earlier draw that stands took it to, never above 100;
- materials stored on site count up to what the line has left once the work in place is counted, in whole dollars;
- the draw asks for the work this period plus the change in what is stored (only the newest draw's stored counts),
  less the statement of work's retainage;
- it keeps each line that moved (a credit's too, the fix above) or holds stored materials.

**The real days a report sets** (`withReportedActuals`, G-55): on a job being built, the first report over 0% sets
the line's bar's real start, and 100% its finish, today, where none is recorded. The schedule's guard lets real days
pass as records, so no plan-write flag is needed. A pay application's claim sets no real days, as the prototype's
`tradeSendPayApp` sets none.

**What the window and the portal send**, by the kernels' line ids (`SovLine.id`: the scope item, or a change order
line's own id):
- a pay application: `{ lines: [{ line, toPct, stored? }], periodTo, address, license, signedBy, signedTitle }`, and
  from the office also `fileName` and `driveUrl`;
- approve for less: `{ <line>: <percent we approve> }` and a note;
- send back: `{ <line>: <percent we see> }` and a note.

## Before P5, and what waits

**Before P5**: all of U6a to U6d, walked on the test project through the office's came-in presses. The bed calls the
trade's four as the service role, as U5a's did. One thing the walk needs is not P5: a signed statement of work. Only
P2c-i's `gc_trade_sign_sow` signs one, from the portal, after B6-b-i and the company's master agreement (call 6).

**Waits for P5**:
- **P5c**: the portal's kinds `sow_report`, `pay_app`, `final_pay_app`, `unconditional_waiver` and `sign_change` on
  `submit-gc-trade-portal`, and the portal's Pay block (`GcPortalPay`, the pay application's door in
  `GcBuildingPayApp.tsx`, and `GcTradeSow`'s report). The keys U6a adds go in WAITING as `'P5'` until then.
- **P5a**: the trade's own PDF and waiver uploads into Drive.
- **The trade's waiver forms**: the lien waiver train's four forms with the trade as the one who signs, in its portal.
- **P5d**: `report_part`, a part of a split line, with the schedule's PR 16. U6a refuses a split line's whole report
  (`splitLine`).
- **`send_sov` and `drawOnTheirSov`**: the trade's own schedule of values beside ours (P2c's doc gives them to U6 with
  P5c).

## The refusals, in plain words

Every sentence the SQL says to a person, read out of the SQL below by the same check as U4's and U5's, through
`plainWordsFailures`: **66 sentences, 0 failing**.

| Press | Sentence |
|---|---|
| every office press | *Sign in first.* |
| each office press | *A training account cannot …* · *A digital twin cannot …* (record a pay application, approve a pay application, send a pay application back, mark a draw paid, record a waiver, take a back-charge off a draw, send a change to a trade) |
| came in | *No trade with that id.* · *Pay applications are for a job we are building.* · *Their statement of work is not signed yet.* · *Pay application 2 is waiting on us. Approve it or send it back first.* · *Each line must be on their statement of work, with its percent done.* · *Say the day the pay application runs to.* · *Say who signed it.* · *There is nothing to pay. No work is new since their last pay application.* |
| approve, less, back, paid | *No pay application with that id.* · *Only a pay application waiting on us is approved.* · *The retainage release is approved at closeout.* · *Say why we approve less.* · *Give the percent we approve on each line we doubt.* · *Approve less only on a line this pay application claims.* · *That is not less than they asked. Approve it as it is.* · *Only a pay application waiting on us goes back.* · *Say what to fix.* · *Give the percent we see on each line we doubt.* · *Mark only the lines this pay application claims.* · *Only an approved draw is marked paid.* |
| waiver | *The unconditional waiver comes after we pay the draw.* · *Their unconditional waiver is in already.* |
| back-charge | *No back-charge with that id.* · *That charge came off draw 2 already.* · *That charge was dropped.* · *They disputed that charge. Keep it or drop it first.* · *They have until Oct 14 to answer that charge.* · *Take a charge off a draw on the same statement of work.* · *Take a charge off a draw we approved and have not paid.* · *That draw pays less than the charge.* |
| change to the trade | *No change order with that id.* · *Only a change order the customer signed goes to the trade.* · *This change is our own work. It goes to no trade.* · *It went to them already.* |
| the trade's presses, as DETAIL | *No statement of work for that trade.* (`notFound`) · *Only the company we awarded this trade can report its work.* and *… can send its pay application.* (`notOnTrade`) · *Sign your statement of work first.* (`sowNotSigned`) · *Reports open once we are building the job.* and *Pay applications open …* (`jobNotBuilding`) · *That line is not on your statement of work.* (`notFound`) · *Say the percent done.* (`badRequest`) · *This line is split into parts. Report each part.* (`splitLine`) · *Your last pay application is still with us.* (`drawWaiting`) · *Each line needs its percent done. The pay application needs its period.* (`badRequest`) · *Type the name of who signs it.* (`nameNeeded`) · *No work is new since your last pay application.* (`nothingToBill`) · *No pay application with that id.* (`notFound`) · *Only the company on this statement of work signs its waivers.* and *… signs its changes.* (`notOnTrade`) · *The unconditional waiver comes after we pay the draw.* (`notPaidYet`) · *You signed it already.* (`alreadySigned`) · *No change was sent to you with that id.* (`notFound`) |

`notFound`, `notOnTrade`, `badRequest` and `nameNeeded` are keys the portal already says, and `jobNotBuilding` is in
WAITING since U5a. U6a lists the new ones in WAITING (`src/lib/gc/gcTradeSubmit.test.ts`) as `'P5'`: `sowNotSigned`,
`drawWaiting`, `nothingToBill`, `splitLine`, `notPaidYet`, and `alreadySigned` unless P2c-i has listed or mapped it
first (Helper 13). The Portal's P5c maps them in `TRADE_SQL_ERRORS` and the page's words.

## The SQL as it will be

`supabase/migrations/<stamp>_gc_trade_draws.sql`. The stamp and `v2.NNNN` are the only things that change at the cut.

```sql
SET lock_timeout = '3s';

-- GC mode, the real build, the Building lane's U6a (v2.NNNN): the trades' money on real data. A trade reports each
-- line of its signed statement of work and sends a pay application with its G702 and G703; the office approves it,
-- approves it for less, or sends it back, marks it paid, takes a back-charge off it, and sends a signed change order
-- to the trade, who signs it into its statement of work. A pay application that came by email or on paper is recorded
-- by the office, and so is an unconditional waiver that came in. Each refuses in words what the prototype's reducer
-- refuses (tradeReport, tradeSendPayApp, approveDraw, approveDrawLess, sendDrawBack, payDraw, takeBackCharge,
-- tradeSignUnconditional, sendTradeChange, tradeSignChange). A draw's money is worked out here from what it claims,
-- by the kernels' rules (payApplication and drawMoney in src/lib/gc/building.ts), never taken from the caller: the
-- parity scenario in supabase/tests/gc_building/60_draws.sql holds the two equal. The office's presses are SECURITY
-- INVOKER, so RLS decides who may: dev only until Building's door, then the money roles (decision 4). The trade's
-- presses are the service role's only, and refuse with keys as the Portal's P2a verbs do. Closeout (the final pay
-- application, the retainage release, accepting the work, closing the job) is U6c's. Plan:
-- to-dos/gc-mode/mockups/building-u6.md on spike/gc-mode. The statement of work: 20261009140000. Back-charges:
-- 20261010006000. Change orders: 20261008010000. Promises: 20261008020000.

-- A draw: one pay application from a trade on its statement of work (Draw), with the pay application's own words
-- (DrawPayApp). A resend after we sent one back takes the same number, and the one sent back stays as it went
-- (status sent_back: DrawSentBack), so no pay application is ever stored twice. Its money is gc_draw_money's.
CREATE TABLE IF NOT EXISTS public.gc_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id uuid NOT NULL REFERENCES public.gc_sows(id) ON DELETE CASCADE,
  number integer NOT NULL
    CONSTRAINT gc_draws_number_positive CHECK (number > 0),
  requested_on date NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CONSTRAINT gc_draws_status_known CHECK (status IN ('requested', 'approved', 'paid', 'sent_back')),
  -- The work this period plus the change in what is stored on site, less retainage, as approved (as asked until
  -- then). A back-charge taken off it is the charge's row (gc_back_charges.taken_draw_id), never subtracted here.
  gross numeric(14,2) NOT NULL,
  retainage numeric(14,2) NOT NULL,
  net numeric(14,2) NOT NULL,
  -- The retainage release (U6c): the last draw, once the work is accepted. It pays back what was held.
  final boolean NOT NULL DEFAULT false,
  -- The trade's lien waiver for it: conditional with the ask, unconditional once it is paid.
  waiver text NOT NULL DEFAULT 'conditional'
    CONSTRAINT gc_draws_waiver_known CHECK (waiver IN ('conditional', 'unconditional')),
  waiver_on date,
  approved_on date,
  paid_on date,
  -- Approved for less (the owner, 2026-10-02): what they asked, as it went, why we approved less, and the day.
  asked jsonb
    CONSTRAINT gc_draws_asked_object CHECK (asked IS NULL OR jsonb_typeof(asked) = 'object'),
  -- Sent back: the day and what to fix. The percent we see on a line we doubt is on its line (we_see).
  sent_back_on date,
  sent_back_note text,
  -- The pay application's own words.
  period_to date NOT NULL,
  address text NOT NULL DEFAULT '',
  license text NOT NULL DEFAULT '',
  signed_by text NOT NULL
    CONSTRAINT gc_draws_signed CHECK (btrim(signed_by) <> ''),
  signed_title text NOT NULL DEFAULT '',
  signed_on date NOT NULL,
  -- A pay application that came by email or on paper: its file, and who of ours recorded it. Null: from the portal.
  file_name text,
  drive_url text,
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The order rows were made: a resend sorts after the one sent back, whatever the clock says.
  seq bigint GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT gc_draws_net_adds CHECK (net = gross - retainage),
  CONSTRAINT gc_draws_approved_dated CHECK ((status IN ('approved', 'paid')) = (approved_on IS NOT NULL)),
  CONSTRAINT gc_draws_paid_dated CHECK ((status = 'paid') = (paid_on IS NOT NULL)),
  CONSTRAINT gc_draws_sent_back_dated CHECK ((status = 'sent_back') = (sent_back_on IS NOT NULL)),
  CONSTRAINT gc_draws_waiver_after_paid CHECK (waiver = 'conditional' OR status = 'paid'),
  CONSTRAINT gc_draws_waiver_dated CHECK ((waiver = 'unconditional') = (waiver_on IS NOT NULL)),
  CONSTRAINT gc_draws_asked_when_approved CHECK (asked IS NULL OR status IN ('approved', 'paid')),
  CONSTRAINT gc_draws_final_pays_back CHECK (NOT final OR (gross = 0 AND retainage <= 0))
);

COMMENT ON TABLE public.gc_draws IS
  'GC mode (v2.NNNN, Building U6a): a trade''s pay application on its statement of work (Draw, DrawPayApp): asked, approved (perhaps for less, asked keeps what they asked), paid, or sent back (DrawSentBack, its resend takes the same number), with its lien waiver. Its money is gc_draw_money''s from what it claims. Written by gc_draw_came_in, gc_approve_draw, gc_approve_draw_less, gc_send_draw_back, gc_pay_draw, gc_draw_waiver_in and the service role''s gc_trade_pay_app and gc_trade_unconditional_waiver. Dev only while it is built.';

-- One number per statement of work among the draws that stand, and one waiting on us at a time.
CREATE UNIQUE INDEX IF NOT EXISTS gc_draws_number_once ON public.gc_draws (sow_id, number) WHERE status <> 'sent_back';
CREATE UNIQUE INDEX IF NOT EXISTS gc_draws_one_waiting ON public.gc_draws (sow_id) WHERE status = 'requested';

-- What a draw claims on each line (Draw.lines): the percent done it takes the line to, and the materials stored on
-- site in dollars (question 12), a balance, so only the newest draw's counts. On a draw sent back, we_see is the
-- percent we see on a line we doubt. The line's check waits for the end of the transaction, so a whole project still
-- goes by cascade.
CREATE TABLE IF NOT EXISTS public.gc_draw_lines (
  draw_id uuid NOT NULL REFERENCES public.gc_draws(id) ON DELETE CASCADE,
  sow_line_id uuid NOT NULL REFERENCES public.gc_sow_lines(id) DEFERRABLE INITIALLY DEFERRED,
  to_pct numeric NOT NULL
    CONSTRAINT gc_draw_lines_pct_range CHECK (to_pct >= 0 AND to_pct <= 100),
  stored numeric(14,2) NOT NULL DEFAULT 0
    CONSTRAINT gc_draw_lines_stored_not_negative CHECK (stored >= 0),
  we_see numeric
    CONSTRAINT gc_draw_lines_we_see_range CHECK (we_see IS NULL OR (we_see >= 0 AND we_see <= 100)),
  PRIMARY KEY (draw_id, sow_line_id)
);

COMMENT ON TABLE public.gc_draw_lines IS
  'GC mode (v2.NNNN, Building U6a): what a draw claims on each line of the statement of work (Draw.lines): the percent done (to_pct), the materials stored on site in dollars, and on one sent back the percent we see on a line we doubt (we_see). A line''s billed percent is the most an approved or paid draw took it to. Dev only while it is built.';

CREATE INDEX IF NOT EXISTS gc_draw_lines_line_idx ON public.gc_draw_lines (sow_line_id);

-- A trade's report on a line of its statement of work (SovLine.pctReported is the newest), from its portal or, for
-- a pay application that came by email, typed by one of ours. Never below what is billed. Append only.
CREATE TABLE IF NOT EXISTS public.gc_sow_line_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_line_id uuid NOT NULL REFERENCES public.gc_sow_lines(id) ON DELETE CASCADE,
  pct numeric NOT NULL
    CONSTRAINT gc_sow_line_reports_pct_range CHECK (pct >= 0 AND pct <= 100),
  reported_on date NOT NULL,
  -- Whose report it is: the company on the statement of work. Who of ours typed it in: null from the portal.
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE RESTRICT,
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The order rows were made: the newest report is the last one, whatever the clock says.
  seq bigint GENERATED ALWAYS AS IDENTITY
);

COMMENT ON TABLE public.gc_sow_line_reports IS
  'GC mode (v2.NNNN, Building U6a): a trade''s percent done on a line of its statement of work (SovLine.pctReported is the newest), from gc_trade_sow_report, a pay application''s claim, or a credit signed in. Append only. Dev only while it is built.';

CREATE INDEX IF NOT EXISTS gc_sow_line_reports_newest_idx ON public.gc_sow_line_reports (sow_line_id, seq DESC);

-- A signed change order sent to the trade it belongs to, as a change to its statement of work
-- (ChangeOrder.tradeChange). Once the trade signs it, it is a line of their statement of work, for what the change
-- costs us. Owner Billing's table carries no Building column (decision 3).
CREATE TABLE IF NOT EXISTS public.gc_change_order_trade_sends (
  change_order_id uuid PRIMARY KEY REFERENCES public.gc_change_orders(id) ON DELETE CASCADE,
  sow_id uuid NOT NULL REFERENCES public.gc_sows(id) ON DELETE CASCADE,
  sent_on date NOT NULL,
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  signed_on date,
  -- The line of their statement of work it became.
  sow_line_id uuid REFERENCES public.gc_sow_lines(id) ON DELETE SET NULL,
  CONSTRAINT gc_change_order_trade_sends_line_when_signed CHECK (sow_line_id IS NULL OR signed_on IS NOT NULL)
);

COMMENT ON TABLE public.gc_change_order_trade_sends IS
  'GC mode (v2.NNNN, Building U6a): a signed change order sent to its trade as a change to the statement of work (ChangeOrder.tradeChange), and the day the trade signed it into a line of its own (sow_line_id). Written by gc_send_trade_change and the service role''s gc_trade_sign_change. Dev only while it is built.';

-- A change order's line may take money off: a credit, work coming out. Only a change order's line.
ALTER TABLE public.gc_sow_lines DROP CONSTRAINT IF EXISTS gc_sow_lines_amount_not_negative;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_sow_lines_credit_by_change_order' AND conrelid = 'public.gc_sow_lines'::regclass) THEN
    ALTER TABLE public.gc_sow_lines ADD CONSTRAINT gc_sow_lines_credit_by_change_order CHECK (amount >= 0 OR change_order_id IS NOT NULL);
  END IF;
END $$;

-- The kernels' SovLine.id, said where the next reader looks (B6-a's own note named the change order): the scope item's
-- id when the line has one, else the line's own id (gc_sow_line_of), never the change order's.
COMMENT ON COLUMN public.gc_sow_lines.change_order_id IS
  'GC mode (v2.NNNN, Building U6a): the signed change order this line came from (gc_trade_sign_change), for its cost to the trade, a credit when below none. The kernels'' SovLine.id is the scope item''s id when the line has one, else this line''s own id (gc_sow_line_of), never the change order''s.';

-- The draw a back-charge came off (P4a's column, which waited for this table). Its check waits for the end of the
-- transaction, as the draw's lines do.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_back_charges_taken_draw_fkey' AND conrelid = 'public.gc_back_charges'::regclass) THEN
    ALTER TABLE public.gc_back_charges
      ADD CONSTRAINT gc_back_charges_taken_draw_fkey FOREIGN KEY (taken_draw_id) REFERENCES public.gc_draws(id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
GRANT UPDATE (taken_draw_id, taken_on) ON TABLE public.gc_back_charges TO authenticated;

ALTER TABLE public.gc_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_draw_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_sow_line_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_change_order_trade_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_draws_dev ON public.gc_draws;
CREATE POLICY gc_draws_dev ON public.gc_draws FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_draw_lines_dev ON public.gc_draw_lines;
CREATE POLICY gc_draw_lines_dev ON public.gc_draw_lines FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_sow_line_reports_dev ON public.gc_sow_line_reports;
CREATE POLICY gc_sow_line_reports_dev ON public.gc_sow_line_reports FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_change_order_trade_sends_dev ON public.gc_change_order_trade_sends;
CREATE POLICY gc_change_order_trade_sends_dev ON public.gc_change_order_trade_sends FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));

-- Nobody signed out reaches them, and a report stays as it went.
REVOKE ALL ON TABLE public.gc_draws, public.gc_draw_lines, public.gc_sow_line_reports, public.gc_change_order_trade_sends FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.gc_sow_line_reports FROM authenticated;

-- A line of a statement of work by the kernels' id (SovLine.id): its scope item, or its own id on a change order's
-- line. Null: not a line of it.
CREATE OR REPLACE FUNCTION public.gc_sow_line_of(p_sow_id uuid, p_key uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT l.id FROM public.gc_sow_lines l
  WHERE l.sow_id = p_sow_id AND (l.scope_item_id = p_key OR (l.scope_item_id IS NULL AND l.id = p_key))
$$;

-- What a pay application claims, read the way the window sends it, by the kernels' line ids: each line once, its
-- percent a number and its stored dollars a number or none. Null: a line not on the statement of work, or a percent
-- that is not a number. Otherwise [{line: <gc_sow_lines id>, toPct, stored}].
CREATE OR REPLACE FUNCTION public.gc_draw_claim(p_sow_id uuid, p_lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_seen uuid[] := '{}';
  v_item jsonb;
  v_line uuid;
BEGIN
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
    RETURN NULL;
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    IF jsonb_typeof(v_item->'toPct') IS DISTINCT FROM 'number'
       OR (v_item ? 'stored' AND jsonb_typeof(v_item->'stored') NOT IN ('number', 'null')) THEN
      RETURN NULL;
    END IF;
    BEGIN
      v_line := public.gc_sow_line_of(p_sow_id, (v_item->>'line')::uuid);
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN NULL;
    END;
    IF v_line IS NULL THEN
      RETURN NULL;
    END IF;
    IF v_line = ANY (v_seen) THEN
      CONTINUE;
    END IF;
    v_seen := v_seen || v_line;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'line', v_line,
      'toPct', (v_item->>'toPct')::numeric,
      'stored', coalesce((v_item->>'stored')::numeric, 0)
    ));
  END LOOP;
  RETURN v_out;
END;
$$;

-- A pay application's money, by the kernels' rules (payApplication and drawMoney; 60_draws.sql holds them equal).
-- Each line is taken to its claim, never below what an earlier draw that stands took it to and never above 100.
-- Materials stored on site count up to what the line has left once the work in place is counted, in whole dollars.
-- The draw asks for the work this period plus the change in what is stored (only the newest draw's stored counts),
-- less the statement of work's retainage. It keeps each line that moved or holds stored materials: a credit's line
-- moves too, so a credit comes off once and its line reads billed. Returns {gross, retainage, net, lines,
-- reported}: `lines` what the draw keeps, `reported` every claimed line's percent.
CREATE OR REPLACE FUNCTION public.gc_draw_money(p_sow_id uuid, p_number integer, p_claim jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH claim AS (
    SELECT (c->>'line')::uuid AS line, (c->>'toPct')::numeric AS to_pct, coalesce((c->>'stored')::numeric, 0) AS stored
    FROM jsonb_array_elements(coalesce(p_claim, '[]'::jsonb)) c
  ),
  earlier AS (
    SELECT d.id, d.number FROM public.gc_draws d
    WHERE d.sow_id = p_sow_id AND d.number < p_number AND d.status <> 'sent_back'
  ),
  worked AS (
    SELECT l.id, l.position, l.amount, b.before, c.line IS NOT NULL AS claimed,
      greatest(b.before, least(100, coalesce(c.to_pct, b.before))) AS now,
      coalesce(c.stored, 0) AS stored
    FROM public.gc_sow_lines l
    CROSS JOIN LATERAL (
      SELECT coalesce(max(dl.to_pct), 0) AS before
      FROM public.gc_draw_lines dl JOIN earlier e ON e.id = dl.draw_id
      WHERE dl.sow_line_id = l.id
    ) b
    LEFT JOIN claim c ON c.line = l.id
    WHERE l.sow_id = p_sow_id
  ),
  money AS (
    SELECT id, position, claimed, now,
      amount * now / 100 - amount * before / 100 AS this_period,
      greatest(0, least(amount - amount * now / 100, round(stored))) AS on_site
    FROM worked
  ),
  gross AS (
    SELECT round(
      coalesce((SELECT sum(this_period + on_site) FROM money), 0)
      - coalesce((SELECT sum(dl.stored) FROM public.gc_draw_lines dl
                  WHERE dl.draw_id = (SELECT e.id FROM earlier e ORDER BY e.number DESC LIMIT 1)), 0),
      2) AS v
  ),
  held AS (
    SELECT round(g.v * s.retainage_pct / 100, 2) AS v
    FROM gross g CROSS JOIN public.gc_sows s WHERE s.id = p_sow_id
  )
  SELECT jsonb_build_object(
    'gross', g.v,
    'retainage', h.v,
    'net', g.v - h.v,
    'lines', coalesce((SELECT jsonb_agg(jsonb_build_object('line', m.id, 'toPct', m.now, 'stored', m.on_site) ORDER BY m.position)
                       FROM money m WHERE m.this_period <> 0 OR m.on_site > 0), '[]'::jsonb),
    'reported', coalesce((SELECT jsonb_agg(jsonb_build_object('line', m.id, 'pct', m.now) ORDER BY m.position)
                          FROM money m WHERE m.claimed), '[]'::jsonb)
  )
  FROM gross g CROSS JOIN held h
$$;

-- Record a pay application that came by email or on paper (new beside the prototype, as the submittal's came-in is):
-- the percent done and the stored dollars on each line, the day it runs to, who signed it, and its Drive link. It
-- follows the trade's own rules: a job being built, a signed statement of work, one waiting at a time, and money to
-- pay. What it claims is the trade's report on each line. It keeps their promise of a pay application.
CREATE OR REPLACE FUNCTION public.gc_draw_came_in(p_package_id uuid, p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project uuid;
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
  v_waiting integer;
  v_claim jsonb;
  v_period date;
  v_signed_by text := btrim(coalesce(p->>'signedBy', ''));
  v_number integer;
  v_money jsonb;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- The tables' read-only blocks and the twin fence refuse the writes too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a pay application.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a pay application.' USING ERRCODE = '42501';
  END IF;
  SELECT k.project_id, g.stage INTO v_project, v_stage
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trade with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'Pay applications are for a job we are building.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id FOR UPDATE;
  IF NOT FOUND OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'Their statement of work is not signed yet.' USING ERRCODE = 'P0001';
  END IF;
  SELECT number INTO v_waiting FROM public.gc_draws WHERE sow_id = v_sow.id AND status = 'requested';
  IF FOUND THEN
    RAISE EXCEPTION 'Pay application % is waiting on us. Approve it or send it back first.', v_waiting USING ERRCODE = 'P0001';
  END IF;
  v_claim := public.gc_draw_claim(v_sow.id, p->'lines');
  IF v_claim IS NULL THEN
    RAISE EXCEPTION 'Each line must be on their statement of work, with its percent done.' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    v_period := nullif(btrim(coalesce(p->>'periodTo', '')), '')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    v_period := NULL;
  END;
  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Say the day the pay application runs to.' USING ERRCODE = 'P0001';
  END IF;
  IF v_signed_by = '' THEN
    RAISE EXCEPTION 'Say who signed it.' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) + 1 INTO v_number FROM public.gc_draws WHERE sow_id = v_sow.id AND status <> 'sent_back';
  v_money := public.gc_draw_money(v_sow.id, v_number, v_claim);
  IF (v_money->>'gross')::numeric <= 0 THEN
    RAISE EXCEPTION 'There is nothing to pay. No work is new since their last pay application.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.gc_draws (sow_id, number, requested_on, gross, retainage, net, period_to, address, license, signed_by, signed_title, signed_on, file_name, drive_url, recorded_by)
  VALUES (
    v_sow.id, v_number, public.app_today(),
    (v_money->>'gross')::numeric, (v_money->>'retainage')::numeric, (v_money->>'net')::numeric,
    v_period, btrim(coalesce(p->>'address', '')), btrim(coalesce(p->>'license', '')), v_signed_by,
    btrim(coalesce(p->>'signedTitle', '')), public.app_today(),
    nullif(btrim(coalesce(p->>'fileName', '')), ''), nullif(btrim(coalesce(p->>'driveUrl', '')), ''), v_uid
  )
  RETURNING id INTO v_id;
  INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct, stored)
  SELECT v_id, (l->>'line')::uuid, (l->>'toPct')::numeric, (l->>'stored')::numeric
  FROM jsonb_array_elements(v_money->'lines') l;
  -- What it claims is their report on each line it names, where that changes it.
  INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id, recorded_by)
  SELECT (r->>'line')::uuid, (r->>'pct')::numeric, public.app_today(), v_sow.company_id, v_uid
  FROM jsonb_array_elements(v_money->'reported') r
  WHERE (r->>'pct')::numeric IS DISTINCT FROM (
    SELECT x.pct FROM public.gc_sow_line_reports x WHERE x.sow_line_id = (r->>'line')::uuid
    ORDER BY x.seq DESC LIMIT 1
  );
  PERFORM public.gc_keep_promises(v_sow.company_id, 'payApp', v_project, p_package_id, public.app_today());
  RETURN v_id;
END;
$$;

-- Approve a pay application as asked (approveDraw). The lines it claims are billed. The retainage release is
-- approved at closeout (U6c). The papers that hold an approval (partnerBlockers) are the window's, as the prototype's
-- reducer trusts its screen.
CREATE OR REPLACE FUNCTION public.gc_approve_draw(p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot approve a pay application.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot approve a pay application.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pay application with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'requested' THEN
    RAISE EXCEPTION 'Only a pay application waiting on us is approved.' USING ERRCODE = 'P0001';
  END IF;
  IF v.final THEN
    RAISE EXCEPTION 'The retainage release is approved at closeout.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_draws SET status = 'approved', approved_on = public.app_today() WHERE id = p_draw_id;
  RETURN public.app_today();
END;
$$;

-- Approve a pay application for less than it asks (approveDrawLess, the owner, 2026-10-02): the percent we approve on
-- each line we doubt (by the kernels' line ids), never above what they asked; the stored materials as asked. It pays
-- as approved, and the draw keeps what they asked. The rest of their reported work stays theirs to ask for.
CREATE OR REPLACE FUNCTION public.gc_approve_draw_less(p_draw_id uuid, p_we_approve jsonb, p_note text)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
  v_approve jsonb := '{}'::jsonb;
  v_item record;
  v_line uuid;
  v_claim jsonb;
  v_money jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot approve a pay application.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot approve a pay application.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pay application with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'requested' THEN
    RAISE EXCEPTION 'Only a pay application waiting on us is approved.' USING ERRCODE = 'P0001';
  END IF;
  IF v.final THEN
    RAISE EXCEPTION 'The retainage release is approved at closeout.' USING ERRCODE = 'P0001';
  END IF;
  IF v_note = '' THEN
    RAISE EXCEPTION 'Say why we approve less.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_we_approve) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Give the percent we approve on each line we doubt.' USING ERRCODE = 'P0001';
  END IF;
  FOR v_item IN SELECT key, value FROM jsonb_each(p_we_approve) LOOP
    IF jsonb_typeof(v_item.value) IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Give the percent we approve on each line we doubt.' USING ERRCODE = 'P0001';
    END IF;
    BEGIN
      v_line := public.gc_sow_line_of(v.sow_id, v_item.key::uuid);
    EXCEPTION WHEN invalid_text_representation THEN
      v_line := NULL;
    END;
    IF v_line IS NULL OR NOT EXISTS (SELECT 1 FROM public.gc_draw_lines WHERE draw_id = p_draw_id AND sow_line_id = v_line) THEN
      RAISE EXCEPTION 'Approve less only on a line this pay application claims.' USING ERRCODE = 'P0001';
    END IF;
    v_approve := v_approve || jsonb_build_object(v_line::text, v_item.value);
  END LOOP;
  -- The asked lines, each at the lesser of what they asked and what we approve, the stored materials as asked.
  v_claim := coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'line', dl.sow_line_id,
      'toPct', least(dl.to_pct, coalesce((v_approve->>dl.sow_line_id::text)::numeric, dl.to_pct)),
      'stored', dl.stored))
    FROM public.gc_draw_lines dl WHERE dl.draw_id = p_draw_id
  ), '[]'::jsonb);
  v_money := public.gc_draw_money(v.sow_id, v.number, v_claim);
  IF (v_money->>'net')::numeric >= v.net THEN
    RAISE EXCEPTION 'That is not less than they asked. Approve it as it is.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_draws SET
    status = 'approved',
    approved_on = public.app_today(),
    asked = jsonb_build_object(
      'gross', v.gross, 'retainage', v.retainage, 'net', v.net,
      'lines', coalesce((SELECT jsonb_agg(jsonb_build_object('line', dl.sow_line_id, 'toPct', dl.to_pct, 'stored', dl.stored) ORDER BY l.position)
                         FROM public.gc_draw_lines dl JOIN public.gc_sow_lines l ON l.id = dl.sow_line_id WHERE dl.draw_id = p_draw_id), '[]'::jsonb),
      'note', v_note, 'on', public.app_today()),
    gross = (v_money->>'gross')::numeric,
    retainage = (v_money->>'retainage')::numeric,
    net = (v_money->>'net')::numeric
  WHERE id = p_draw_id;
  DELETE FROM public.gc_draw_lines WHERE draw_id = p_draw_id;
  INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct, stored)
  SELECT p_draw_id, (l->>'line')::uuid, (l->>'toPct')::numeric, (l->>'stored')::numeric
  FROM jsonb_array_elements(v_money->'lines') l;
  RETURN public.app_today();
END;
$$;

-- Send a pay application back to be fixed (sendDrawBack): what to fix, and the percent we see on each line we doubt
-- (by the kernels' line ids), kept where it is less than they asked. It stays as it went, and their resend takes the
-- same number. Their report and what is billed stay as they were.
CREATE OR REPLACE FUNCTION public.gc_send_draw_back(p_draw_id uuid, p_we_see jsonb, p_note text)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
  v_item record;
  v_line uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot send a pay application back.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot send a pay application back.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pay application with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'requested' THEN
    RAISE EXCEPTION 'Only a pay application waiting on us goes back.' USING ERRCODE = 'P0001';
  END IF;
  IF v_note = '' THEN
    RAISE EXCEPTION 'Say what to fix.' USING ERRCODE = 'P0001';
  END IF;
  IF p_we_see IS NOT NULL AND jsonb_typeof(p_we_see) <> 'object' THEN
    RAISE EXCEPTION 'Give the percent we see on each line we doubt.' USING ERRCODE = 'P0001';
  END IF;
  FOR v_item IN SELECT key, value FROM jsonb_each(coalesce(p_we_see, '{}'::jsonb)) LOOP
    IF jsonb_typeof(v_item.value) IS DISTINCT FROM 'number' OR (v_item.value)::text::numeric < 0 OR (v_item.value)::text::numeric > 100 THEN
      RAISE EXCEPTION 'Give the percent we see on each line we doubt.' USING ERRCODE = 'P0001';
    END IF;
    BEGIN
      v_line := public.gc_sow_line_of(v.sow_id, v_item.key::uuid);
    EXCEPTION WHEN invalid_text_representation THEN
      v_line := NULL;
    END;
    IF v_line IS NULL OR NOT EXISTS (SELECT 1 FROM public.gc_draw_lines WHERE draw_id = p_draw_id AND sow_line_id = v_line) THEN
      RAISE EXCEPTION 'Mark only the lines this pay application claims.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.gc_draw_lines SET we_see = (v_item.value)::text::numeric
    WHERE draw_id = p_draw_id AND sow_line_id = v_line AND (v_item.value)::text::numeric < to_pct;
  END LOOP;
  UPDATE public.gc_draws SET status = 'sent_back', sent_back_on = public.app_today(), sent_back_note = v_note WHERE id = p_draw_id;
  RETURN public.app_today();
END;
$$;

-- Mark an approved draw paid (payDraw). The unconditional waiver is owed from then.
CREATE OR REPLACE FUNCTION public.gc_pay_draw(p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot mark a draw paid.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot mark a draw paid.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pay application with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'approved' THEN
    RAISE EXCEPTION 'Only an approved draw is marked paid.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_draws SET status = 'paid', paid_on = public.app_today() WHERE id = p_draw_id;
  RETURN public.app_today();
END;
$$;

-- The trade's unconditional waiver is in for a paid draw. When it was the last paper owed, the promise of their
-- closeout papers is kept (buildingPromisesKeptBy, tradeSignUnconditional): no waiver owed any more, and no final pay
-- application owed either, unless the open promise asked for the waivers alone. Shared by the office's press and
-- the trade's, after each has checked who may. Null: no paid draw owed that waiver.
CREATE OR REPLACE FUNCTION public.gc_draw_waiver_signed(p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sow public.gc_sows%ROWTYPE;
  v_project uuid;
  v_billed boolean;
  v_held numeric;
  v_final_owed boolean;
  v_open text;
BEGIN
  UPDATE public.gc_draws SET waiver = 'unconditional', waiver_on = public.app_today()
  WHERE id = p_draw_id AND status = 'paid' AND waiver = 'conditional';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT s.* INTO v_sow FROM public.gc_sows s JOIN public.gc_draws d ON d.sow_id = s.id WHERE d.id = p_draw_id;
  SELECT project_id INTO v_project FROM public.gc_trade_packages WHERE id = v_sow.package_id;
  IF EXISTS (SELECT 1 FROM public.gc_draws WHERE sow_id = v_sow.id AND status = 'paid' AND waiver = 'conditional') THEN
    RETURN public.app_today();
  END IF;
  -- The final pay application is owed once every line is billed, the work is accepted, retainage is held, and no
  -- draw waits on us and no release went (tradeCloseout's canAskFinal).
  SELECT bool_and(coalesce(b.pct, 0) >= 100) AND count(*) > 0 INTO v_billed
  FROM public.gc_sow_lines l
  LEFT JOIN LATERAL (
    SELECT max(dl.to_pct) AS pct FROM public.gc_draw_lines dl JOIN public.gc_draws d ON d.id = dl.draw_id
    WHERE dl.sow_line_id = l.id AND d.status IN ('approved', 'paid') AND NOT d.final
  ) b ON true
  WHERE l.sow_id = v_sow.id;
  SELECT coalesce(sum(retainage) FILTER (WHERE NOT final AND status IN ('approved', 'paid')), 0)
       - coalesce(sum(net) FILTER (WHERE final AND status = 'paid'), 0)
  INTO v_held FROM public.gc_draws WHERE sow_id = v_sow.id;
  v_final_owed := coalesce(v_billed, false) AND v_sow.accepted_on IS NOT NULL AND v_held > 0
    AND NOT EXISTS (SELECT 1 FROM public.gc_draws WHERE sow_id = v_sow.id AND status <> 'sent_back' AND (final OR status = 'requested'));
  SELECT what INTO v_open FROM public.gc_trade_promises
  WHERE kept_on IS NULL AND kind = 'closeout' AND company_id = v_sow.company_id AND project_id = v_project AND package_id = v_sow.package_id;
  IF v_final_owed AND (v_open IS NULL OR v_open ~* 'final pay application') THEN
    RETURN public.app_today();
  END IF;
  PERFORM public.gc_keep_promises(v_sow.company_id, 'closeout', v_project, v_sow.package_id, public.app_today());
  RETURN public.app_today();
END;
$$;

-- An unconditional waiver that came in by email or on paper, for a paid draw (new beside the prototype, where only
-- the portal signed one).
CREATE OR REPLACE FUNCTION public.gc_draw_waiver_in(p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a waiver.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a waiver.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pay application with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'paid' THEN
    RAISE EXCEPTION 'The unconditional waiver comes after we pay the draw.' USING ERRCODE = 'P0001';
  END IF;
  IF v.waiver = 'unconditional' THEN
    RAISE EXCEPTION 'Their unconditional waiver is in already.' USING ERRCODE = 'P0001';
  END IF;
  RETURN public.gc_draw_waiver_signed(p_draw_id);
END;
$$;

-- Take a back-charge off a draw (takeBackCharge): one they agreed to, we kept after a dispute, or they never answered
-- by its day, off a draw we approved and have not paid, that pays at least the charge after the charges already on it.
CREATE OR REPLACE FUNCTION public.gc_take_back_charge(p_charge_id uuid, p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.gc_back_charges%ROWTYPE;
  d public.gc_draws%ROWTYPE;
  v_taken integer;
  v_left numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot take a back-charge off a draw.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot take a back-charge off a draw.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.gc_back_charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No back-charge with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF c.taken_draw_id IS NOT NULL THEN
    SELECT number INTO v_taken FROM public.gc_draws WHERE id = c.taken_draw_id;
    RAISE EXCEPTION 'That charge came off draw % already.', v_taken USING ERRCODE = 'P0001';
  END IF;
  IF c.status = 'dropped' THEN
    RAISE EXCEPTION 'That charge was dropped.' USING ERRCODE = 'P0001';
  END IF;
  IF c.status = 'disputed' THEN
    RAISE EXCEPTION 'They disputed that charge. Keep it or drop it first.' USING ERRCODE = 'P0001';
  END IF;
  IF c.status = 'open' AND public.app_today() <= c.answer_by THEN
    RAISE EXCEPTION 'They have until % to answer that charge.', to_char(c.answer_by, 'Mon FMDD') USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO d FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND OR d.sow_id <> c.sow_id THEN
    RAISE EXCEPTION 'Take a charge off a draw on the same statement of work.' USING ERRCODE = 'P0001';
  END IF;
  IF d.status <> 'approved' THEN
    RAISE EXCEPTION 'Take a charge off a draw we approved and have not paid.' USING ERRCODE = 'P0001';
  END IF;
  SELECT d.net - coalesce(sum(amount), 0) INTO v_left FROM public.gc_back_charges WHERE taken_draw_id = p_draw_id;
  IF v_left < c.amount THEN
    RAISE EXCEPTION 'That draw pays less than the charge.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_back_charges SET taken_draw_id = p_draw_id, taken_on = public.app_today() WHERE id = p_charge_id;
  RETURN public.app_today();
END;
$$;

-- Send a signed change order to the trade it belongs to, as a change to its statement of work (sendTradeChange), for
-- what the change costs us. Not our own work, and only once.
CREATE OR REPLACE FUNCTION public.gc_send_trade_change(p_change_order_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  co public.gc_change_orders%ROWTYPE;
  v_ours boolean;
  v_sow public.gc_sows%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot send a change to a trade.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot send a change to a trade.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO co FROM public.gc_change_orders WHERE id = p_change_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No change order with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF co.status <> 'signed' THEN
    RAISE EXCEPTION 'Only a change order the customer signed goes to the trade.' USING ERRCODE = 'P0001';
  END IF;
  SELECT ours INTO v_ours FROM public.gc_trade_packages WHERE id = co.package_id;
  IF co.package_id IS NULL OR v_ours THEN
    RAISE EXCEPTION 'This change is our own work. It goes to no trade.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = co.package_id;
  IF NOT FOUND OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'Their statement of work is not signed yet.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_change_order_trade_sends WHERE change_order_id = p_change_order_id) THEN
    RAISE EXCEPTION 'It went to them already.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.gc_change_order_trade_sends (change_order_id, sow_id, sent_on, sent_by)
  VALUES (p_change_order_id, v_sow.id, public.app_today(), v_uid);
  RETURN public.app_today();
END;
$$;

-- A trade reports a line of its statement of work from its portal (tradeReport): never below what is billed. A line
-- split into parts is reported a part at a time (G-39, the schedule's PR 16 with the Portal's P5d). On a job being
-- built, the report sets the line's real days on the schedule where none is recorded (withReportedActuals, G-55):
-- the first report over 0% its start, 100% its finish, today. Real days are records the schedule's guard lets pass.
CREATE OR REPLACE FUNCTION public.gc_trade_sow_report(p_company_id uuid, p_package_id uuid, p_line uuid, p_pct numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project uuid;
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
  v_line public.gc_sow_lines%ROWTYPE;
  v_billed numeric;
  v_pct numeric;
BEGIN
  SELECT k.project_id, g.stage INTO v_project, v_stage
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id;
  IF v_project IS NULL OR v_sow.id IS NULL THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No statement of work for that trade.';
  END IF;
  IF v_sow.company_id IS DISTINCT FROM p_company_id
     OR NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = p_package_id AND awarded_invite_id = v_sow.invite_id) THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can report its work.';
  END IF;
  IF v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'sowNotSigned' USING ERRCODE = 'P0001', DETAIL = 'Sign your statement of work first.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'Reports open once we are building the job.';
  END IF;
  SELECT * INTO v_line FROM public.gc_sow_lines WHERE id = public.gc_sow_line_of(v_sow.id, p_line);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'That line is not on your statement of work.';
  END IF;
  IF p_pct IS NULL THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Say the percent done.';
  END IF;
  IF v_line.scope_item_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.gc_schedule_activities a JOIN public.gc_schedule_activity_parts pt ON pt.activity_id = a.id
    WHERE a.project_id = v_project AND a.kind = 'line' AND a.scope_item_id = v_line.scope_item_id
  ) THEN
    RAISE EXCEPTION 'splitLine' USING ERRCODE = 'P0001', DETAIL = 'This line is split into parts. Report each part.';
  END IF;
  SELECT coalesce(max(dl.to_pct), 0) INTO v_billed
  FROM public.gc_draw_lines dl JOIN public.gc_draws d ON d.id = dl.draw_id
  WHERE dl.sow_line_id = v_line.id AND d.status IN ('approved', 'paid') AND NOT d.final;
  v_pct := greatest(v_billed, least(100, greatest(0, p_pct)));
  INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id, recorded_by)
  VALUES (v_line.id, v_pct, public.app_today(), p_company_id, NULL);
  IF v_line.scope_item_id IS NOT NULL AND v_pct > 0 THEN
    UPDATE public.gc_schedule_activities SET
      actual_start = coalesce(actual_start, public.app_today()),
      actual_finish = CASE WHEN v_pct >= 100 THEN coalesce(actual_finish, public.app_today()) ELSE actual_finish END
    WHERE project_id = v_project AND kind = 'line' AND scope_item_id = v_line.scope_item_id
      AND (actual_start IS NULL OR (v_pct >= 100 AND actual_finish IS NULL));
  END IF;
  RETURN v_pct;
END;
$$;

-- A trade sends a pay application from its portal (tradeSendPayApp): what it claims on each line by the kernels' line
-- ids, the day it runs to, the address and license it prints, and who signs it, with the conditional waiver. Its
-- money is worked out here. What it claims is their report on each line it names, even lower than before (a resend
-- after we sent one back). It keeps their promise of a pay application.
CREATE OR REPLACE FUNCTION public.gc_trade_pay_app(p_company_id uuid, p_package_id uuid, p_app jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project uuid;
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
  v_claim jsonb;
  v_period date;
  v_signed_by text := btrim(coalesce(p_app->>'signedBy', ''));
  v_number integer;
  v_money jsonb;
  v_id uuid;
BEGIN
  SELECT k.project_id, g.stage INTO v_project, v_stage
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id FOR UPDATE;
  IF v_project IS NULL OR v_sow.id IS NULL THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No statement of work for that trade.';
  END IF;
  IF v_sow.company_id IS DISTINCT FROM p_company_id
     OR NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = p_package_id AND awarded_invite_id = v_sow.invite_id) THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can send its pay application.';
  END IF;
  IF v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'sowNotSigned' USING ERRCODE = 'P0001', DETAIL = 'Sign your statement of work first.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'Pay applications open once we are building the job.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_draws WHERE sow_id = v_sow.id AND status = 'requested') THEN
    RAISE EXCEPTION 'drawWaiting' USING ERRCODE = 'P0001', DETAIL = 'Your last pay application is still with us.';
  END IF;
  v_claim := public.gc_draw_claim(v_sow.id, p_app->'lines');
  BEGIN
    v_period := nullif(btrim(coalesce(p_app->>'periodTo', '')), '')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    v_period := NULL;
  END;
  IF v_claim IS NULL OR v_period IS NULL THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Each line needs its percent done. The pay application needs its period.';
  END IF;
  IF v_signed_by = '' THEN
    RAISE EXCEPTION 'nameNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type the name of who signs it.';
  END IF;

  SELECT count(*) + 1 INTO v_number FROM public.gc_draws WHERE sow_id = v_sow.id AND status <> 'sent_back';
  v_money := public.gc_draw_money(v_sow.id, v_number, v_claim);
  IF (v_money->>'gross')::numeric <= 0 THEN
    RAISE EXCEPTION 'nothingToBill' USING ERRCODE = 'P0001', DETAIL = 'No work is new since your last pay application.';
  END IF;

  -- Nobody of ours typed it in: the trade's portal did (recorded_by null).
  INSERT INTO public.gc_draws (sow_id, number, requested_on, gross, retainage, net, period_to, address, license, signed_by, signed_title, signed_on, recorded_by)
  VALUES (
    v_sow.id, v_number, public.app_today(),
    (v_money->>'gross')::numeric, (v_money->>'retainage')::numeric, (v_money->>'net')::numeric,
    v_period, btrim(coalesce(p_app->>'address', '')), btrim(coalesce(p_app->>'license', '')), v_signed_by,
    btrim(coalesce(p_app->>'signedTitle', '')), public.app_today(), NULL
  )
  RETURNING id INTO v_id;
  INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct, stored)
  SELECT v_id, (l->>'line')::uuid, (l->>'toPct')::numeric, (l->>'stored')::numeric
  FROM jsonb_array_elements(v_money->'lines') l;
  INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id, recorded_by)
  SELECT (r->>'line')::uuid, (r->>'pct')::numeric, public.app_today(), p_company_id, NULL
  FROM jsonb_array_elements(v_money->'reported') r
  WHERE (r->>'pct')::numeric IS DISTINCT FROM (
    SELECT x.pct FROM public.gc_sow_line_reports x WHERE x.sow_line_id = (r->>'line')::uuid
    ORDER BY x.seq DESC LIMIT 1
  );
  PERFORM public.gc_keep_promises(p_company_id, 'payApp', v_project, p_package_id, public.app_today());
  RETURN v_id;
END;
$$;

-- A trade signs the unconditional waiver for a draw we paid, from its portal (tradeSignUnconditional).
CREATE OR REPLACE FUNCTION public.gc_trade_unconditional_waiver(p_company_id uuid, p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
  v_company uuid;
BEGIN
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No pay application with that id.';
  END IF;
  SELECT company_id INTO v_company FROM public.gc_sows WHERE id = v.sow_id;
  IF v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company on this statement of work signs its waivers.';
  END IF;
  IF v.status <> 'paid' THEN
    RAISE EXCEPTION 'notPaidYet' USING ERRCODE = 'P0001', DETAIL = 'The unconditional waiver comes after we pay the draw.';
  END IF;
  IF v.waiver = 'unconditional' THEN
    RAISE EXCEPTION 'alreadySigned' USING ERRCODE = 'P0001', DETAIL = 'You signed it already.';
  END IF;
  RETURN public.gc_draw_waiver_signed(p_draw_id);
END;
$$;

-- A trade signs a change we sent it, from its portal (tradeSignChange): the change becomes a line of its statement of
-- work, for what it costs us, reported and drawn on like any other. A credit counts as done at once, so it comes off
-- their next draw. Returns the new line.
CREATE OR REPLACE FUNCTION public.gc_trade_sign_change(p_company_id uuid, p_change_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_send public.gc_change_order_trade_sends%ROWTYPE;
  v_sow public.gc_sows%ROWTYPE;
  co public.gc_change_orders%ROWTYPE;
  v_line uuid;
BEGIN
  SELECT * INTO v_send FROM public.gc_change_order_trade_sends WHERE change_order_id = p_change_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No change was sent to you with that id.';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE id = v_send.sow_id;
  IF v_sow.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company on this statement of work signs its changes.';
  END IF;
  IF v_send.signed_on IS NOT NULL THEN
    RAISE EXCEPTION 'alreadySigned' USING ERRCODE = 'P0001', DETAIL = 'You signed it already.';
  END IF;
  SELECT * INTO co FROM public.gc_change_orders WHERE id = p_change_order_id;
  INSERT INTO public.gc_sow_lines (sow_id, position, label, amount, change_order_id)
  VALUES (
    v_sow.id,
    (SELECT coalesce(max(position), -1) + 1 FROM public.gc_sow_lines WHERE sow_id = v_sow.id),
    'Change order ' || co.number || ': ' || co.description,
    co.cost,
    co.id
  )
  RETURNING id INTO v_line;
  IF co.cost < 0 THEN
    INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id, recorded_by)
    VALUES (v_line, 100, public.app_today(), p_company_id, NULL);
  END IF;
  UPDATE public.gc_change_order_trade_sends SET signed_on = public.app_today(), sow_line_id = v_line WHERE change_order_id = p_change_order_id;
  RETURN v_line;
END;
$$;

COMMENT ON FUNCTION public.gc_sow_line_of(uuid, uuid) IS
  'GC mode (v2.NNNN, Building U6a): a statement of work''s line by the kernels'' id (SovLine.id: its scope item, or its own id on a change order''s line). Null: not a line of it.';
COMMENT ON FUNCTION public.gc_draw_claim(uuid, jsonb) IS
  'GC mode (v2.NNNN, Building U6a): a pay application''s claim as the window or the portal sends it, by the kernels'' line ids, read into the statement of work''s lines, each once. Null: a line not on it, or a percent that is not a number.';
COMMENT ON FUNCTION public.gc_draw_money(uuid, integer, jsonb) IS
  'GC mode (v2.NNNN, Building U6a): a pay application''s money by the kernels'' rules (payApplication, drawMoney): each line clamped between what an earlier draw that stands billed and 100, stored materials up to what the line has left, the work this period plus the change in what is stored, less the retainage. Keeps each line that moved or holds stored materials. supabase/tests/gc_building/60_draws.sql holds it to the kernel.';
COMMENT ON FUNCTION public.gc_draw_came_in(uuid, jsonb) IS
  'GC mode (v2.NNNN): record a trade''s pay application that came by email or on paper, by the trade''s own rules, with its Drive link; its claim is their report, and it keeps their pay application promise. Refuses a training account, a digital twin, a job not being built, a statement of work not signed, one already waiting, a line not on it, no period, no signer, and nothing to pay. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_approve_draw(uuid) IS
  'GC mode (v2.NNNN): approve a pay application waiting on us as asked (approveDraw); the lines it claims are billed. Not the retainage release (U6c). SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_approve_draw_less(uuid, jsonb, text) IS
  'GC mode (v2.NNNN): approve a pay application for less (approveDrawLess): the percent we approve on each line we doubt, with why; the draw keeps what they asked. Refuses one not less than asked. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_send_draw_back(uuid, jsonb, text) IS
  'GC mode (v2.NNNN): send a pay application back (sendDrawBack) with what to fix and the percent we see on each line we doubt; it stays as it went, and the resend takes its number. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_pay_draw(uuid) IS
  'GC mode (v2.NNNN): mark an approved draw paid (payDraw). SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_draw_waiver_signed(uuid) IS
  'GC mode (v2.NNNN): the unconditional waiver is in for a paid draw, and the promise of the closeout papers is kept when it was the last paper owed (tradeSignUnconditional''s rule). Called by gc_draw_waiver_in and gc_trade_unconditional_waiver after their checks. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_draw_waiver_in(uuid) IS
  'GC mode (v2.NNNN): record a trade''s unconditional waiver that came by email or on paper, for a paid draw. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_take_back_charge(uuid, uuid) IS
  'GC mode (v2.NNNN): take a back-charge off an approved, unpaid draw on the same statement of work (takeBackCharge): agreed, kept, or never answered by its day, and no more than the draw pays after the charges on it. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_send_trade_change(uuid) IS
  'GC mode (v2.NNNN): send a signed change order to its trade as a change to the statement of work (sendTradeChange), once, for a trade we hire with a signed statement of work. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_trade_sow_report(uuid, uuid, uuid, numeric) IS
  'GC mode (v2.NNNN): a trade''s report on a line of its signed statement of work (tradeReport), never below billed, and the line''s real days on the schedule where none is recorded: notFound, notOnTrade, sowNotSigned, jobNotBuilding, badRequest, splitLine. Service role only.';
COMMENT ON FUNCTION public.gc_trade_pay_app(uuid, uuid, jsonb) IS
  'GC mode (v2.NNNN): a trade''s pay application from its portal (tradeSendPayApp), its money worked out here, its claim their report: notFound, notOnTrade, sowNotSigned, jobNotBuilding, drawWaiting, badRequest, nameNeeded, nothingToBill. Service role only.';
COMMENT ON FUNCTION public.gc_trade_unconditional_waiver(uuid, uuid) IS
  'GC mode (v2.NNNN): a trade signs the unconditional waiver for a paid draw (tradeSignUnconditional): notFound, notOnTrade, notPaidYet, alreadySigned. Service role only.';
COMMENT ON FUNCTION public.gc_trade_sign_change(uuid, uuid) IS
  'GC mode (v2.NNNN): a trade signs a change we sent it into a line of its statement of work (tradeSignChange); a credit counts as done: notFound, notOnTrade, alreadySigned. Service role only.';

REVOKE ALL ON FUNCTION public.gc_sow_line_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_sow_line_of(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gc_draw_claim(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_draw_claim(uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gc_draw_money(uuid, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_draw_money(uuid, integer, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gc_draw_waiver_signed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_draw_waiver_signed(uuid) TO authenticated, service_role;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.gc_draw_came_in(uuid, jsonb)', 'public.gc_approve_draw(uuid)', 'public.gc_approve_draw_less(uuid, jsonb, text)',
    'public.gc_send_draw_back(uuid, jsonb, text)', 'public.gc_pay_draw(uuid)', 'public.gc_draw_waiver_in(uuid)',
    'public.gc_take_back_charge(uuid, uuid)', 'public.gc_send_trade_change(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
  -- Only the service role: the portal's submit function, after it has turned a link into its company.
  FOREACH f IN ARRAY ARRAY['public.gc_trade_sow_report(uuid, uuid, uuid, numeric)', 'public.gc_trade_pay_app(uuid, uuid, jsonb)',
    'public.gc_trade_unconditional_waiver(uuid, uuid)', 'public.gc_trade_sign_change(uuid, uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
```

## The SQL tests

**The bed.** `scripts/pgtest-gc-building.sh` loops over every scenario since U4a. U6a adds one line to its `PRESSES`
list, `supabase/migrations/*_gc_trade_draws.sql`, and one path to `.github/workflows/sql-beds.yml`,
`- 'supabase/migrations/*gc_trade_draws*'`. It also adds the new keys to WAITING in
`src/lib/gc/gcTradeSubmit.test.ts`, and the four tables to `src/lib/gc/doors.ts` (dev, Building, opened by
Building's door to the money roles), which `doors.test.ts` reads from the migration.

**The scenario**, `supabase/tests/gc_building/60_draws.sql`. Each money row is what `src/lib/gc/building.ts` gives
for the same statement of work and claims, with the fix above (worked out on main at 6186bb429):

| Step | Claim | Kernel and SQL |
|---|---|---|
| 1, the trade's | Footings 50%, Slab 10% with $2,500.40 stored | $10,300 / $1,030 / $9,270 (stored counts in whole dollars) |
| 3, came by email | Footings 100%, Slab 40% | $8,900 / $890 / $8,010 ($11,400 of work less the $2,500 no longer stored) |
| 5, resent after we sent it back | Footings 100%, Slab 30% | $7,100 / $710 / $6,390 |
| 6, approved for less | Footings at 90% | $5,900 / $590 / $5,310 |
| 9, with the credit | Footings 100%, Slab 40%, the credit | $1,000 / $100 / $900, the credit's line kept |
| 10, clamps | Footings 30% (billed 100%), Slab 50% with $9,999.60 stored | $10,800 / $1,080 / $9,720 ($9,000 stored, what the line has left) |

```sql
-- The trades' money (v2.NNNN, the Building lane's U6a): a trade's pay application, from its portal or recorded by the
-- office when it came by email, approved, approved for less, sent back and sent again under its number, paid, its
-- unconditional waiver in; a back-charge taken off a draw; a signed change order sent to the trade and signed into a
-- line of its statement of work, a credit taken off once; a trade's report and the real days it sets. The money is
-- held to the kernels' payApplication and drawMoney: each number below is what src/lib/gc/building.ts gives for the
-- same statement of work and claims (a credit's line kept once it moves). Each press refuses in words, or the trade's
-- in keys, what the prototype's reducer refuses. A training account, a digital twin and a role outside Building's
-- dev door are refused; the trade's presses are the service role's only. Presses run through RLS, the fixture made as
-- postgres; everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "gc_building PASSED". See scripts/pgtest-gc-building.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, a dev who is a digital twin, and an estimator (no policy on Building's
-- tables while they are built).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@draws.test'),
  ('00000000-0000-0000-0000-0000000009d2', 'trainee@draws.test'),
  ('00000000-0000-0000-0000-0000000009d3', 'twin@draws.test'),
  ('00000000-0000-0000-0000-0000000009d4', 'estimator@draws.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000009d1', 'dev@draws.test', 'Draws Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000009d2', 'trainee@draws.test', 'Draws Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000009d3', 'twin@draws.test', 'Draws Twin', 'dev'),
  ('00000000-0000-0000-0000-0000000009d4', 'estimator@draws.test', 'Draws Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000009d2';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000009d3';

-- Two GC jobs. A is being built: Concrete awarded to Ridgeway Concrete with a signed statement of work at 10%
-- retainage (Footings $12,000, Slab $18,000, and Walks $0, split into two parts on the schedule), Steel awarded to
-- Halverson Steel with a draft, and our own Plumbing. B is in buyout: Electrical awarded to Ridgeway, signed.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000009c1', 'Draws Test Owner', '00000000-0000-0000-0000-0000000009d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000009a1', 'Draws test A', '00000000-0000-0000-0000-0000000009c1'),
  ('00000000-0000-0000-0000-0000000009a2', 'Draws test B', '00000000-0000-0000-0000-0000000009c1');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES
  ('00000000-0000-0000-0000-0000000009a1', 'building', public.app_today() - 40),
  ('00000000-0000-0000-0000-0000000009a2', 'buyout', NULL);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-0000000009e1', 'Ridgeway Concrete', ARRAY['Concrete']),
  ('00000000-0000-0000-0000-0000000009e2', 'Halverson Steel', ARRAY['Steel']);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009a1', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009a1', 'Steel', 1, false),
  ('00000000-0000-0000-0000-0000000009b3', '00000000-0000-0000-0000-0000000009a1', 'Plumbing', 2, true),
  ('00000000-0000-0000-0000-0000000009b4', '00000000-0000-0000-0000-0000000009a2', 'Electrical', 0, false);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009e1'),
  ('00000000-0000-0000-0000-0000000009f2', '00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009e2'),
  ('00000000-0000-0000-0000-0000000009f3', '00000000-0000-0000-0000-0000000009b4', '00000000-0000-0000-0000-0000000009e1');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000009f1', awarded_on = public.app_today() - 35 WHERE id = '00000000-0000-0000-0000-0000000009b1';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000009f2', awarded_on = public.app_today() - 35 WHERE id = '00000000-0000-0000-0000-0000000009b2';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000009f3', awarded_on = public.app_today() - 6 WHERE id = '00000000-0000-0000-0000-0000000009b4';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-000000090001', '00000000-0000-0000-0000-0000000009b1', 'Footings', 0),
  ('00000000-0000-0000-0000-000000090002', '00000000-0000-0000-0000-0000000009b1', 'Slab', 1),
  ('00000000-0000-0000-0000-000000090005', '00000000-0000-0000-0000-0000000009b1', 'Walks', 2),
  ('00000000-0000-0000-0000-000000090003', '00000000-0000-0000-0000-0000000009b2', 'Frame', 0),
  ('00000000-0000-0000-0000-000000090004', '00000000-0000-0000-0000-0000000009b4', 'Rough-in', 0);
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-000000009101', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009f1', '00000000-0000-0000-0000-0000000009e1', 'signed', 30000, 10, public.app_today() - 32, public.app_today() - 30),
  ('00000000-0000-0000-0000-000000009102', '00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-0000000009f2', '00000000-0000-0000-0000-0000000009e2', 'draft', 5000, 10, NULL, NULL),
  ('00000000-0000-0000-0000-000000009103', '00000000-0000-0000-0000-0000000009b4', '00000000-0000-0000-0000-0000000009f3', '00000000-0000-0000-0000-0000000009e1', 'signed', 8000, 10, public.app_today() - 6, public.app_today() - 5);
INSERT INTO public.gc_sow_lines (id, sow_id, position, label, amount, scope_item_id) VALUES
  ('00000000-0000-0000-0000-000000009201', '00000000-0000-0000-0000-000000009101', 0, 'Footings', 12000, '00000000-0000-0000-0000-000000090001'),
  ('00000000-0000-0000-0000-000000009202', '00000000-0000-0000-0000-000000009101', 1, 'Slab', 18000, '00000000-0000-0000-0000-000000090002'),
  ('00000000-0000-0000-0000-000000009205', '00000000-0000-0000-0000-000000009101', 2, 'Walks', 0, '00000000-0000-0000-0000-000000090005'),
  ('00000000-0000-0000-0000-000000009203', '00000000-0000-0000-0000-000000009102', 0, 'Frame', 5000, '00000000-0000-0000-0000-000000090003'),
  ('00000000-0000-0000-0000-000000009204', '00000000-0000-0000-0000-000000009103', 0, 'Rough-in', 8000, '00000000-0000-0000-0000-000000090004');
-- A's schedule, drawn as a plan write does (gc_schedule_bump's flag): Footings and Slab with no real days yet, and
-- Walks in two parts.
SELECT set_config('gc.schedule_plan_write', 'on', true);
INSERT INTO public.gc_schedules (project_id, drafted_on) VALUES ('00000000-0000-0000-0000-0000000009a1', public.app_today() - 35);
INSERT INTO public.gc_schedule_activities (id, project_id, kind, position, scope_item_id, package_id, start, finish) VALUES
  ('00000000-0000-0000-0000-000000009701', '00000000-0000-0000-0000-0000000009a1', 'line', 0, '00000000-0000-0000-0000-000000090001', '00000000-0000-0000-0000-0000000009b1', public.app_today() - 20, public.app_today() - 5),
  ('00000000-0000-0000-0000-000000009702', '00000000-0000-0000-0000-0000000009a1', 'line', 1, '00000000-0000-0000-0000-000000090002', '00000000-0000-0000-0000-0000000009b1', public.app_today() - 2, public.app_today() + 10),
  ('00000000-0000-0000-0000-000000009705', '00000000-0000-0000-0000-0000000009a1', 'line', 2, '00000000-0000-0000-0000-000000090005', '00000000-0000-0000-0000-0000000009b1', public.app_today() + 12, public.app_today() + 20);
INSERT INTO public.gc_schedule_activity_parts (activity_id, position, name, from_day, days, share) VALUES
  ('00000000-0000-0000-0000-000000009705', 0, 'North walks', 0, 4, 50),
  ('00000000-0000-0000-0000-000000009705', 1, 'South walks', 4, 4, 50);
SELECT set_config('gc.schedule_plan_write', '', true);
-- Change orders the customer signed: a $2,000 credit on Concrete, our own Plumbing's, and Steel's; and a Concrete draft.
INSERT INTO public.gc_change_orders (id, project_id, number, description, reason, package_id, cost, price, status, sent_on, answered_on, answered_how) VALUES
  ('00000000-0000-0000-0000-000000009301', '00000000-0000-0000-0000-0000000009a1', 1, 'Leave out the curb', 'owner', '00000000-0000-0000-0000-0000000009b1', -2000, -2200, 'signed', public.app_today() - 6, public.app_today() - 4, 'office'),
  ('00000000-0000-0000-0000-000000009302', '00000000-0000-0000-0000-0000000009a1', 2, 'Move the mop sink', 'field', '00000000-0000-0000-0000-0000000009b3', 1000, 1100, 'signed', public.app_today() - 6, public.app_today() - 4, 'office'),
  ('00000000-0000-0000-0000-000000009303', '00000000-0000-0000-0000-0000000009a1', 3, 'Thicker slab at grid C', 'plans', '00000000-0000-0000-0000-0000000009b1', 500, 550, 'draft', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-000000009304', '00000000-0000-0000-0000-0000000009a1', 4, 'Add a lintel', 'field', '00000000-0000-0000-0000-0000000009b2', 700, 770, 'signed', public.app_today() - 6, public.app_today() - 4, 'office');
-- Back-charges on Concrete: agreed, open and still in its days to answer, disputed, dropped, and kept for more than a
-- draw pays.
INSERT INTO public.gc_back_charges (id, project_id, package_id, company_id, sow_id, amount, reason, sent_on, status, answered_on, answer_note, settled_on, settled_note) VALUES
  ('00000000-0000-0000-0000-000000009401', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009101', 500, 'Washout on the street', public.app_today() - 10, 'agreed', public.app_today() - 8, NULL, NULL, NULL),
  ('00000000-0000-0000-0000-000000009402', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009101', 300, 'Broken curb stop', public.app_today(), 'open', NULL, NULL, NULL, NULL),
  ('00000000-0000-0000-0000-000000009403', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009101', 200, 'Cleanup', public.app_today() - 10, 'disputed', public.app_today() - 9, 'Not our mess', NULL, NULL),
  ('00000000-0000-0000-0000-000000009404', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009101', 100, 'Dumpster', public.app_today() - 10, 'dropped', NULL, NULL, public.app_today() - 3, 'Our mistake'),
  ('00000000-0000-0000-0000-000000009405', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009101', 6000, 'Finished the walks for them', public.app_today() - 20, 'kept', NULL, NULL, public.app_today() - 2, 'Photos show it');
-- What Ridgeway promised on Concrete: its pay application, and the unconditional waiver on draw 1.
INSERT INTO public.gc_trade_promises (id, company_id, kind, project_id, package_id, what, due_on, source) VALUES
  ('00000000-0000-0000-0000-000000009601', '00000000-0000-0000-0000-0000000009e1', 'payApp', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', 'their first pay application', public.app_today() + 3, 'office'),
  ('00000000-0000-0000-0000-000000009602', '00000000-0000-0000-0000-0000000009e1', 'closeout', '00000000-0000-0000-0000-0000000009a1', '00000000-0000-0000-0000-0000000009b1', 'the unconditional waiver on draw 1', public.app_today() + 10, 'office');
-- An approved draw on B's Electrical, another statement of work.
INSERT INTO public.gc_draws (id, sow_id, number, requested_on, status, gross, retainage, net, approved_on, period_to, signed_by, signed_on) VALUES
  ('00000000-0000-0000-0000-000000009501', '00000000-0000-0000-0000-000000009103', 1, public.app_today() - 1, 'approved', 1000, 100, 900, public.app_today() - 1, public.app_today() - 1, 'Pat Ridgeway', public.app_today() - 1);

CREATE SCHEMA gbt;
CREATE FUNCTION gbt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION gbt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- A trade's refusal: its key, and the reason in plain words the key carries.
CREATE FUNCTION gbt.trade_refused(label text, stmt text, want_key text, want_detail text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF SQLERRM IS DISTINCT FROM want_key OR v_detail IS DISTINCT FROM want_detail THEN
      RAISE EXCEPTION '% was refused as % (%), not % (%)', label, SQLERRM, v_detail, want_key, want_detail;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION gbt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
END $$;
-- One line of a claim, by the kernels' id: its percent done, and stored dollars where given.
CREATE FUNCTION gbt.line(p_key uuid, p_pct numeric, p_stored numeric DEFAULT NULL) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('line', p_key, 'toPct', p_pct) || CASE WHEN p_stored IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('stored', p_stored) END $$;
-- A pay application as the window or the portal sends it.
CREATE FUNCTION gbt.app(p_lines jsonb, extra jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('lines', p_lines, 'periodTo', public.app_today()::text, 'address', '12 Mill Rd, Boerne', 'license', 'TX-4471',
    'signedBy', ' Pat Ridgeway ', 'signedTitle', 'Owner') || extra $$;
-- The draw that stands on Concrete by its number.
CREATE FUNCTION gbt.draw(p_number integer) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gc_draws WHERE sow_id = '00000000-0000-0000-0000-000000009101' AND number = p_number AND status <> 'sent_back' $$;
-- The change order's line on Concrete, by its own id (the kernels' id for a change order's line).
CREATE FUNCTION gbt.change_line() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gc_sow_lines WHERE change_order_id = '00000000-0000-0000-0000-000000009301' $$;
-- What Concrete's draws read, in their order, one sent back before its resend: number, status, waiver, money, and
-- each line's percent, stored dollars (+) and the percent we see (~).
CREATE FUNCTION gbt.draws() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(
    'D' || d.number || ' ' || d.status || ' ' || d.waiver || ' ' || trim_scale(d.gross) || '/' || trim_scale(d.retainage) || '/' || trim_scale(d.net) || ' '
      || coalesce((SELECT string_agg(l.label || ':' || trim_scale(dl.to_pct) || CASE WHEN dl.stored > 0 THEN '+' || trim_scale(dl.stored) ELSE '' END
                                       || coalesce('~' || trim_scale(dl.we_see), ''), ',' ORDER BY l.position)
                   FROM public.gc_draw_lines dl JOIN public.gc_sow_lines l ON l.id = dl.sow_line_id WHERE dl.draw_id = d.id), '-'),
    E'\n' ORDER BY d.number, d.seq)
  FROM public.gc_draws d WHERE d.sow_id = '00000000-0000-0000-0000-000000009101' $$;
-- Each Concrete line's newest report.
CREATE FUNCTION gbt.reported() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(l.label || ':' || coalesce(trim_scale(r.pct)::text, '-'), ',' ORDER BY l.position)
  FROM public.gc_sow_lines l
  LEFT JOIN LATERAL (SELECT x.pct FROM public.gc_sow_line_reports x WHERE x.sow_line_id = l.id ORDER BY x.seq DESC LIMIT 1) r ON true
  WHERE l.sow_id = '00000000-0000-0000-0000-000000009101' $$;
GRANT USAGE ON SCHEMA gbt TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, service_role;

-- The functions themselves: invoker's rights; the office's presses and the shared helpers for signed-in callers, the
-- trade's for the service role only.
SELECT gbt.same('every function runs with the caller''s rights',
  (SELECT string_agg(DISTINCT prosecdef::text, ',') FROM pg_proc WHERE proname IN ('gc_sow_line_of', 'gc_draw_claim', 'gc_draw_money', 'gc_draw_came_in',
    'gc_approve_draw', 'gc_approve_draw_less', 'gc_send_draw_back', 'gc_pay_draw', 'gc_draw_waiver_signed', 'gc_draw_waiver_in', 'gc_take_back_charge',
    'gc_send_trade_change', 'gc_trade_sow_report', 'gc_trade_pay_app', 'gc_trade_unconditional_waiver', 'gc_trade_sign_change')),
  'false');
SELECT gbt.same('who runs each: signed out, signed in, the service role',
  (SELECT string_agg(f || ':' || has_function_privilege('anon', f, 'EXECUTE') || '/' || has_function_privilege('authenticated', f, 'EXECUTE') || '/' || has_function_privilege('service_role', f, 'EXECUTE'), ',')
   FROM unnest(ARRAY['public.gc_draw_money(uuid, integer, jsonb)', 'public.gc_draw_came_in(uuid, jsonb)', 'public.gc_approve_draw_less(uuid, jsonb, text)',
     'public.gc_take_back_charge(uuid, uuid)', 'public.gc_trade_sow_report(uuid, uuid, uuid, numeric)', 'public.gc_trade_pay_app(uuid, uuid, jsonb)',
     'public.gc_trade_unconditional_waiver(uuid, uuid)', 'public.gc_trade_sign_change(uuid, uuid)']) f),
  'public.gc_draw_money(uuid, integer, jsonb):false/true/true,public.gc_draw_came_in(uuid, jsonb):false/true/true,public.gc_approve_draw_less(uuid, jsonb, text):false/true/true,public.gc_take_back_charge(uuid, uuid):false/true/true,public.gc_trade_sow_report(uuid, uuid, uuid, numeric):false/false/true,public.gc_trade_pay_app(uuid, uuid, jsonb):false/false/true,public.gc_trade_unconditional_waiver(uuid, uuid):false/false/true,public.gc_trade_sign_change(uuid, uuid):false/false/true');
SELECT gbt.same('a change order''s line may be a credit, and a back-charge''s draw is a draw',
  (SELECT string_agg(conname, ',' ORDER BY conname) FROM pg_constraint
   WHERE conname IN ('gc_sow_lines_amount_not_negative', 'gc_sow_lines_credit_by_change_order', 'gc_back_charges_taken_draw_fkey')),
  'gc_back_charges_taken_draw_fkey,gc_sow_lines_credit_by_change_order');

-- 1. The trade's first pay application from its portal, as the service role: Footings to 50%, Slab to 10% with
-- $2,500.40 of materials stored, counted in whole dollars. The kernel: $10,300 less $1,030 held, $9,270.
SET LOCAL ROLE service_role;
SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(
  gbt.line('00000000-0000-0000-0000-000000090001', 50), gbt.line('00000000-0000-0000-0000-000000090002', 10, 2500.4))));
SELECT gbt.trade_refused('a trade that does not exist', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009ff', gbt.app('[]'))$s$, 'notFound', 'No statement of work for that trade.');
SELECT gbt.trade_refused('another company''s trade', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-0000000009b1', gbt.app('[]'))$s$, 'notOnTrade', 'Only the company we awarded this trade can send its pay application.');
SELECT gbt.trade_refused('a statement of work not signed', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-0000000009b2', gbt.app('[]'))$s$, 'sowNotSigned', 'Sign your statement of work first.');
SELECT gbt.trade_refused('a job not being built', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b4', gbt.app('[]'))$s$, 'jobNotBuilding', 'Pay applications open once we are building the job.');
SELECT gbt.trade_refused('a second while one waits', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090001', 60))))$s$, 'drawWaiting', 'Your last pay application is still with us.');
RESET ROLE;
SELECT gbt.same('the first pay application, its money by the kernels'' rules', gbt.draws(), 'D1 requested conditional 10300/1030/9270 Footings:50,Slab:10+2500');
SELECT gbt.same('what it claims is their report', gbt.reported(), 'Footings:50,Slab:10,Walks:-');
SELECT gbt.same('its words, and no one of ours named', (SELECT signed_by || ' | ' || address || ' | ' || license || ' | ' || (period_to = public.app_today()) || ' | ' || (recorded_by IS NULL) || ' | ' || (file_name IS NULL) FROM public.gc_draws WHERE id = gbt.draw(1)),
  'Pat Ridgeway | 12 Mill Rd, Boerne | TX-4471 | true | true | true');
SELECT gbt.same('it keeps their promise of a pay application', (SELECT (kept_on = public.app_today())::text FROM public.gc_trade_promises WHERE id = '00000000-0000-0000-0000-000000009601'), 'true');

-- 2. The office approves it, marks it paid, and records the unconditional waiver that came by email.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d2');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account approves', $s$SELECT public.gc_approve_draw(gbt.draw(1))$s$, 'A training account cannot approve a pay application');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d3');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin approves', $s$SELECT public.gc_approve_draw(gbt.draw(1))$s$, 'A digital twin cannot approve a pay application');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d4');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('an estimator approves, outside Building''s dev door', $s$SELECT public.gc_approve_draw(gbt.draw(1))$s$, 'No pay application with that id');
SELECT gbt.refused('a signed-in caller cannot be the trade', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app('[]'))$s$, 'permission denied');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('paid before it is approved', $s$SELECT public.gc_pay_draw(gbt.draw(1))$s$, 'Only an approved draw is marked paid');
SELECT gbt.same('approved today', (public.gc_approve_draw(gbt.draw(1)) - public.app_today())::text, '0');
SELECT gbt.refused('approved twice', $s$SELECT public.gc_approve_draw(gbt.draw(1))$s$, 'Only a pay application waiting on us is approved');
SELECT gbt.refused('the waiver before it is paid', $s$SELECT public.gc_draw_waiver_in(gbt.draw(1))$s$, 'The unconditional waiver comes after we pay the draw');
SELECT gbt.same('paid today', (public.gc_pay_draw(gbt.draw(1)) - public.app_today())::text, '0');
SELECT gbt.refused('paid twice', $s$SELECT public.gc_pay_draw(gbt.draw(1))$s$, 'Only an approved draw is marked paid');
SELECT public.gc_draw_waiver_in(gbt.draw(1));
SELECT gbt.refused('the waiver twice', $s$SELECT public.gc_draw_waiver_in(gbt.draw(1))$s$, 'Their unconditional waiver is in already');
SELECT gbt.same('the last paper owed keeps the promise of the waivers', (SELECT (kept_on = public.app_today())::text FROM public.gc_trade_promises WHERE id = '00000000-0000-0000-0000-000000009602'), 'true');
RESET ROLE;

-- The trade's other refusals, with nothing waiting.
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('a line not on the statement of work', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090003', 50))))$s$, 'badRequest', 'Each line needs its percent done. The pay application needs its period.');
SELECT gbt.trade_refused('a percent that is not a number', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app('[{"line": "00000000-0000-0000-0000-000000090001", "toPct": "lots"}]'))$s$, 'badRequest', 'Each line needs its percent done. The pay application needs its period.');
SELECT gbt.trade_refused('no period', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090001', 60)), '{"periodTo": " "}'))$s$, 'badRequest', 'Each line needs its percent done. The pay application needs its period.');
SELECT gbt.trade_refused('no one signs it', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090001', 60)), '{"signedBy": " "}'))$s$, 'nameNeeded', 'Type the name of who signs it.');
SELECT gbt.trade_refused('nothing new: the stored materials are not asked again', $s$SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090001', 40), gbt.line('00000000-0000-0000-0000-000000090002', 10, 2500))))$s$, 'nothingToBill', 'No work is new since your last pay application.');
RESET ROLE;

-- 3. A pay application that came by email, recorded by the office with its Drive link: Footings to 100%, Slab to
-- 40%, the stored materials built in. The kernel: $11,400 of work less the $2,500 no longer stored is $8,900, less
-- $890 held, $8,010.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(
  gbt.line('00000000-0000-0000-0000-000000090001', 100), gbt.line('00000000-0000-0000-0000-000000090002', 40)),
  '{"fileName": "RCC-pay-2.pdf", "driveUrl": "https://drive.google.com/file/d/pay-2/view"}'));
SELECT gbt.refused('another while one waits', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090002', 50))))$s$, 'Pay application 2 is waiting on us. Approve it or send it back first');
SELECT gbt.refused('a job not being built', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b4', gbt.app('[]'))$s$, 'Pay applications are for a job we are building');
SELECT gbt.refused('a statement of work not signed', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b2', gbt.app('[]'))$s$, 'Their statement of work is not signed yet');
SELECT gbt.refused('a trade that does not exist', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009ff', gbt.app('[]'))$s$, 'No trade with that id');
SELECT gbt.same('the second, its money by the kernels'' rules', gbt.draws(),
  E'D1 paid unconditional 10300/1030/9270 Footings:50,Slab:10+2500\nD2 requested conditional 8900/890/8010 Footings:100,Slab:40');
SELECT gbt.same('the one that came by email names who of ours recorded it, and its file',
  (SELECT (recorded_by = '00000000-0000-0000-0000-0000000009d1') || ' ' || file_name || ' ' || drive_url FROM public.gc_draws WHERE id = gbt.draw(2)),
  'true RCC-pay-2.pdf https://drive.google.com/file/d/pay-2/view');
SELECT gbt.same('its claim is their report, typed by us', gbt.reported() || ' ' || (SELECT count(*) FROM public.gc_sow_line_reports WHERE recorded_by IS NOT NULL), 'Footings:100,Slab:40,Walks:- 2');

-- 4. Sent back: Slab is at 30%, not 40%. Footings at 100% is not doubted.
SELECT gbt.refused('sent back with nothing to fix', $s$SELECT public.gc_send_draw_back(gbt.draw(2), '{}', ' ')$s$, 'Say what to fix');
SELECT gbt.refused('a line it does not claim', $s$SELECT public.gc_send_draw_back(gbt.draw(2), '{"00000000-0000-0000-0000-000000090005": 0}', 'Walks')$s$, 'Mark only the lines this pay application claims');
SELECT gbt.refused('a percent over 100', $s$SELECT public.gc_send_draw_back(gbt.draw(2), '{"00000000-0000-0000-0000-000000090002": 150}', 'Slab')$s$, 'Give the percent we see on each line we doubt');
SELECT public.gc_send_draw_back(gbt.draw(2), '{"00000000-0000-0000-0000-000000090002": 30, "00000000-0000-0000-0000-000000090001": 100}', 'Slab is at 30%, not 40%.');
SELECT gbt.same('it stays as it went, with what we see', gbt.draws(),
  E'D1 paid unconditional 10300/1030/9270 Footings:50,Slab:10+2500\nD2 sent_back conditional 8900/890/8010 Footings:100,Slab:40~30');
SELECT gbt.refused('approving one sent back', $s$SELECT public.gc_approve_draw((SELECT id FROM public.gc_draws WHERE status = 'sent_back'))$s$, 'Only a pay application waiting on us is approved');
-- The office's other refusals, with nothing waiting.
SELECT gbt.refused('a line not on their statement of work', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090004', 50))))$s$, 'Each line must be on their statement of work, with its percent done');
SELECT gbt.refused('no period', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090002', 50)), '{"periodTo": "someday"}'))$s$, 'Say the day the pay application runs to');
SELECT gbt.refused('no one signed it', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090002', 50)), '{"signedBy": ""}'))$s$, 'Say who signed it');
SELECT gbt.refused('nothing to pay', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(gbt.line('00000000-0000-0000-0000-000000090001', 50))))$s$, 'There is nothing to pay. No work is new since their last pay application');
RESET ROLE;

-- 5. The trade sends it again from its portal, fixed: Slab at 30%. It takes the same number. The kernel: $9,600 of
-- work less the $2,500 stored before is $7,100, less $710, $6,390. A resend can lower their report.
SET LOCAL ROLE service_role;
SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(
  gbt.line('00000000-0000-0000-0000-000000090001', 100), gbt.line('00000000-0000-0000-0000-000000090002', 30))));
RESET ROLE;
SELECT gbt.same('the resend under the same number', gbt.draws(),
  E'D1 paid unconditional 10300/1030/9270 Footings:50,Slab:10+2500\nD2 sent_back conditional 8900/890/8010 Footings:100,Slab:40~30\nD2 requested conditional 7100/710/6390 Footings:100,Slab:30');
SELECT gbt.same('their report lowered', gbt.reported(), 'Footings:100,Slab:30,Walks:-');

-- 6. Approved for less: Footings at 90%. The kernel: $4,800 and $3,600 of work less the $2,500 stored before is
-- $5,900, less $590, $5,310. The draw keeps what they asked.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('less with no reason', $s$SELECT public.gc_approve_draw_less(gbt.draw(2), '{"00000000-0000-0000-0000-000000090001": 90}', '')$s$, 'Say why we approve less');
SELECT gbt.refused('less with no percents', $s$SELECT public.gc_approve_draw_less(gbt.draw(2), '[]', 'Footings')$s$, 'Give the percent we approve on each line we doubt');
SELECT gbt.refused('less on a line it does not claim', $s$SELECT public.gc_approve_draw_less(gbt.draw(2), '{"00000000-0000-0000-0000-000000090005": 10}', 'Walks')$s$, 'Approve less only on a line this pay application claims');
SELECT gbt.refused('less that is not less', $s$SELECT public.gc_approve_draw_less(gbt.draw(2), '{"00000000-0000-0000-0000-000000090001": 100}', 'Footings')$s$, 'That is not less than they asked. Approve it as it is');
SELECT gbt.same('approved for less today', (public.gc_approve_draw_less(gbt.draw(2), '{"00000000-0000-0000-0000-000000090001": 90}', ' Footings is at 90%. ') - public.app_today())::text, '0');
SELECT gbt.same('approved for less, by the kernels'' rules', (SELECT string_agg(x, E'\n') FROM unnest(string_to_array(gbt.draws(), E'\n')) x WHERE x LIKE 'D2 approved%'),
  'D2 approved conditional 5900/590/5310 Footings:90,Slab:30');
SELECT gbt.same('what they asked, kept', (SELECT trim_scale((asked->>'gross')::numeric) || '/' || trim_scale((asked->>'retainage')::numeric) || '/' || trim_scale((asked->>'net')::numeric)
    || ' ' || jsonb_array_length(asked->'lines') || ' lines | ' || (asked->>'note') || ' | ' || ((asked->>'on')::date = public.app_today()) FROM public.gc_draws WHERE id = gbt.draw(2)),
  '7100/710/6390 2 lines | Footings is at 90%. | true');

-- 7. Back-charges off the approved draw: only one they agreed to, we kept, or never answered in time, and no more
-- than it pays after the charges on it.
SELECT gbt.refused('a charge still in its days to answer', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009402', gbt.draw(2))$s$, 'They have until');
SELECT gbt.refused('a charge they disputed', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009403', gbt.draw(2))$s$, 'They disputed that charge. Keep it or drop it first');
SELECT gbt.refused('a charge we dropped', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009404', gbt.draw(2))$s$, 'That charge was dropped');
SELECT gbt.refused('a charge more than the draw pays', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009405', gbt.draw(2))$s$, 'That draw pays less than the charge');
SELECT gbt.refused('a draw already paid', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009401', gbt.draw(1))$s$, 'Take a charge off a draw we approved and have not paid');
SELECT gbt.refused('another statement of work''s draw', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009401', '00000000-0000-0000-0000-000000009501')$s$, 'Take a charge off a draw on the same statement of work');
SELECT gbt.refused('a charge that does not exist', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-0000000094ff', gbt.draw(2))$s$, 'No back-charge with that id');
SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009401', gbt.draw(2));
SELECT gbt.refused('a charge twice', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009401', gbt.draw(2))$s$, 'That charge came off draw 2 already');
SELECT gbt.same('the charge names its draw, and the draw keeps what it pays', (SELECT (taken_draw_id = gbt.draw(2)) || ' ' || (taken_on = public.app_today()) FROM public.gc_back_charges WHERE id = '00000000-0000-0000-0000-000000009401')
    || ' ' || (SELECT trim_scale(net) FROM public.gc_draws WHERE id = gbt.draw(2)), 'true true 5310');
SELECT public.gc_pay_draw(gbt.draw(2));
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('a waiver for a draw that does not exist', $s$SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000095ff')$s$, 'notFound', 'No pay application with that id.');
SELECT gbt.trade_refused('another company''s waiver', $s$SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000009e2', gbt.draw(2))$s$, 'notOnTrade', 'Only the company on this statement of work signs its waivers.');
SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000009e1', gbt.draw(2));
SELECT gbt.trade_refused('the waiver twice', $s$SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000009e1', gbt.draw(2))$s$, 'alreadySigned', 'You signed it already.');
RESET ROLE;

-- 8. The credit goes to the trade, who signs it into a line of its statement of work, done at once.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a draft change order', $s$SELECT public.gc_send_trade_change('00000000-0000-0000-0000-000000009303')$s$, 'Only a change order the customer signed goes to the trade');
SELECT gbt.refused('our own work', $s$SELECT public.gc_send_trade_change('00000000-0000-0000-0000-000000009302')$s$, 'This change is our own work. It goes to no trade');
SELECT gbt.refused('a trade with no signed statement of work', $s$SELECT public.gc_send_trade_change('00000000-0000-0000-0000-000000009304')$s$, 'Their statement of work is not signed yet');
SELECT gbt.refused('a change order that does not exist', $s$SELECT public.gc_send_trade_change('00000000-0000-0000-0000-0000000093ff')$s$, 'No change order with that id');
SELECT gbt.same('sent today', (public.gc_send_trade_change('00000000-0000-0000-0000-000000009301') - public.app_today())::text, '0');
SELECT gbt.refused('sent twice', $s$SELECT public.gc_send_trade_change('00000000-0000-0000-0000-000000009301')$s$, 'It went to them already');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('a change never sent', $s$SELECT public.gc_trade_sign_change('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009303')$s$, 'notFound', 'No change was sent to you with that id.');
SELECT gbt.trade_refused('another company signs', $s$SELECT public.gc_trade_sign_change('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-000000009301')$s$, 'notOnTrade', 'Only the company on this statement of work signs its changes.');
SELECT public.gc_trade_sign_change('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009301');
SELECT gbt.trade_refused('signed twice', $s$SELECT public.gc_trade_sign_change('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-000000009301')$s$, 'alreadySigned', 'You signed it already.');
RESET ROLE;
SELECT gbt.same('the credit is a line of their statement of work, done at once',
  (SELECT l.position || ' ' || l.label || ' ' || trim_scale(l.amount) FROM public.gc_sow_lines l WHERE l.id = gbt.change_line()) || ' | ' || gbt.reported()
    || ' | ' || (SELECT (s.signed_on = public.app_today()) || ' ' || (s.sow_line_id = gbt.change_line()) FROM public.gc_change_order_trade_sends s WHERE s.change_order_id = '00000000-0000-0000-0000-000000009301'),
  '3 Change order 1: Leave out the curb -2000 | Footings:100,Slab:30,Walks:-,Change order 1: Leave out the curb:100 | true true');

-- 9. The third: Footings to 100%, Slab to 40%, and the credit. The kernel: $1,200 + $1,800 - $2,000 = $1,000, less
-- $100, $900, and the credit's line kept, so it reads billed.
SET LOCAL ROLE service_role;
SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(
  gbt.line('00000000-0000-0000-0000-000000090001', 100), gbt.line('00000000-0000-0000-0000-000000090002', 40), gbt.line(gbt.change_line(), 100))));
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT public.gc_approve_draw(gbt.draw(3));
SELECT public.gc_pay_draw(gbt.draw(3));
RESET ROLE;
SELECT gbt.same('the credit comes off once, its line kept', (SELECT string_agg(x, E'\n') FROM unnest(string_to_array(gbt.draws(), E'\n')) x WHERE x LIKE 'D3 %'),
  'D3 paid conditional 1000/100/900 Footings:100,Slab:40,Change order 1: Leave out the curb:100');

-- 10. The fourth: a claim below what is billed stays at billed, stored materials count up to what the line has
-- left in whole dollars, and the credit is not taken again. The kernel: Slab $1,800 and $9,000 stored, $10,800,
-- less $1,080, $9,720.
SET LOCAL ROLE service_role;
SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', gbt.app(jsonb_build_array(
  gbt.line('00000000-0000-0000-0000-000000090001', 30), gbt.line('00000000-0000-0000-0000-000000090002', 50, 9999.6), gbt.line(gbt.change_line(), 100))));
SELECT gbt.trade_refused('a waiver before it is paid', $s$SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000009e1', gbt.draw(4))$s$, 'notPaidYet', 'The unconditional waiver comes after we pay the draw.');
RESET ROLE;
SELECT gbt.same('the fourth, by the kernels'' rules', (SELECT string_agg(x, E'\n') FROM unnest(string_to_array(gbt.draws(), E'\n')) x WHERE x LIKE 'D4 %'),
  'D4 requested conditional 10800/1080/9720 Slab:50+9000');
SELECT gbt.same('a claim over 100 is 100', (SELECT trim_scale(((public.gc_draw_money('00000000-0000-0000-0000-000000009101', 5,
  jsonb_build_array(jsonb_build_object('line', '00000000-0000-0000-0000-000000009202', 'toPct', 150))))->'lines'->0->>'toPct')::numeric)::text), '100');

-- 11. The trade's report from its portal: never below billed, and the real days it sets on the schedule.
SET LOCAL ROLE service_role;
SELECT gbt.same('below billed stays at billed', public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090002', 10)::text, '40');
SELECT gbt.same('a report as given', public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090002', 60)::text, '60');
SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090001', 100);
SELECT gbt.trade_refused('a line split into parts', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090005', 20)$s$, 'splitLine', 'This line is split into parts. Report each part.');
SELECT gbt.trade_refused('a line not theirs', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090003', 20)$s$, 'notFound', 'That line is not on your statement of work.');
SELECT gbt.trade_refused('no percent', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090002', NULL)$s$, 'badRequest', 'Say the percent done.');
SELECT gbt.trade_refused('another company reports', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090002', 20)$s$, 'notOnTrade', 'Only the company we awarded this trade can report its work.');
SELECT gbt.trade_refused('a statement of work not signed', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e2', '00000000-0000-0000-0000-0000000009b2', '00000000-0000-0000-0000-000000090003', 20)$s$, 'sowNotSigned', 'Sign your statement of work first.');
SELECT gbt.trade_refused('a job not being built', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b4', '00000000-0000-0000-0000-000000090004', 20)$s$, 'jobNotBuilding', 'Reports open once we are building the job.');
SELECT gbt.trade_refused('a trade that does not exist', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009ff', '00000000-0000-0000-0000-000000090002', 20)$s$, 'notFound', 'No statement of work for that trade.');
RESET ROLE;
SELECT gbt.same('their reports, newest', gbt.reported(), 'Footings:100,Slab:60,Walks:-,Change order 1: Leave out the curb:100');
SELECT gbt.same('the real days the reports set: Footings started and finished today, Slab started today',
  (SELECT string_agg(i.label || ' ' || coalesce((a.actual_start - public.app_today())::text, '-') || ' ' || coalesce((a.actual_finish - public.app_today())::text, '-'), ', ' ORDER BY a.position)
   FROM public.gc_schedule_activities a JOIN public.gc_scope_items i ON i.id = a.scope_item_id WHERE a.project_id = '00000000-0000-0000-0000-0000000009a1'),
  'Footings 0 0, Slab 0 -, Walks - -');

-- Who may not, and what stays as it went.
SELECT gbt.as_user(NULL);
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a caller signed out', $s$SELECT public.gc_approve_draw(gbt.draw(4))$s$, 'Sign in first');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d2');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account records a pay application', $s$SELECT public.gc_draw_came_in('00000000-0000-0000-0000-0000000009b1', gbt.app('[]'))$s$, 'A training account cannot record a pay application');
SELECT gbt.refused('a training account sends a change', $s$SELECT public.gc_send_trade_change('00000000-0000-0000-0000-000000009301')$s$, 'A training account cannot send a change to a trade');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d3');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin sends one back', $s$SELECT public.gc_send_draw_back(gbt.draw(4), '{}', 'x')$s$, 'A digital twin cannot send a pay application back');
SELECT gbt.refused('a digital twin takes a charge', $s$SELECT public.gc_take_back_charge('00000000-0000-0000-0000-000000009405', gbt.draw(4))$s$, 'A digital twin cannot take a back-charge off a draw');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000009d1');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a report changed', $s$UPDATE public.gc_sow_line_reports SET pct = 0$s$, 'permission denied');
SELECT gbt.refused('a dev cannot be the trade', $s$SELECT public.gc_trade_sow_report('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-000000090002', 70)$s$, 'permission denied');
RESET ROLE;
SELECT gbt.same('the draws on Concrete: five rows, one sent back', (SELECT count(*) || ' ' || count(*) FILTER (WHERE status = 'sent_back') FROM public.gc_draws WHERE sow_id = '00000000-0000-0000-0000-000000009101'), '5 1');

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
```

**Run here first, on main's real GC chain.** Docker is off on this Mac, and the other users' Postgres servers fill
its shared memory. So the bed ran in PGlite, real Postgres in-process:
- stand-ins only for what the chain reads outside GC mode, the real `is_read_only`, `is_digital_twin`,
  `block_if_read_only` and the three `apply_*` helpers;
- then main's `*_gc_*` migrations in stamp order at 6186bb429, 30 of 32. The two left out read only the Pipeline's
  money (`20261009233000`, the Monday email's payload, and `20261009235900`, the controller's pay speeds) and touch
  nothing here.

U6a applied twice, and `60_draws.sql` passed its 99 assertions. U5a's `50_rfis.sql` and U4a's `40_submittals.sql`
still passed their 50 each beside it. Ten planted bugs each failed it:
- a credit's line dropped (main's kernel today);
- the stored materials before not taken off;
- a sent-back draw counted as billed before;
- the trade's company not checked;
- a charge taken off a paid draw;
- the waiver keeping no promise;
- approved for less forgetting what was asked;
- a report below billed kept as given;
- stored dollars not counted whole;
- a split line reported whole.

The real bed runs on the PR.

## The migration doc as it will be

````markdown
# <stamp>_gc_trade_draws.sql (2026-10-09, v2.NNNN)

GC mode, the real build, the Building lane's U6a: the trades' money (`to-dos/gc-mode/mockups/building-u6.md` on branch `spike/gc-mode`). Four tables, a foreign key, a widened check, and sixteen functions. The statement of work is the Board's B6-a (`20261009140000`). Back-charges are the Portal's P4a (`20261010006000`). Change orders are Owner Billing's O1 (`20261008010000`). Promises are the Board's B1 (`20261008020000`).

- **`gc_draws`**: one pay application from a trade on its statement of work (`Draw`, `DrawPayApp`, `DrawSentBack`).
  - Its number is unique on the statement of work among the draws that stand. One sent back keeps its row as it went (status `sent_back`), and its resend takes the same number.
  - One waits on us at a time.
  - Its money (`gross`, `retainage`, `net`, with `net = gross - retainage`) is `gc_draw_money`'s, never the caller's.
  - Its waiver is conditional with the ask and unconditional once paid. Approved for less, it keeps what they asked (`asked`).
  - A pay application that came by email keeps its file and who of ours recorded it. `final` is the retainage release, U6c's.
- **`gc_draw_lines`**: what a draw claims on each line (`to_pct`, `stored`), and on one sent back the percent we see (`we_see`). A line's billed percent is the most an approved or paid draw took it to.
- **`gc_sow_line_reports`**: a trade's report on a line, append only. The newest, the last made (`seq`), is `SovLine.pctReported`. `gc_draws` keeps `seq` too, so a resend sorts after the one sent back.
- **`gc_change_order_trade_sends`**: a signed change order sent to its trade (`ChangeOrder.tradeChange`), the day the trade signed it, and the line it became.
- **`gc_sow_lines`**: a change order's line may be a credit (`gc_sow_lines_credit_by_change_order` replaces `gc_sow_lines_amount_not_negative`). The comment on `change_order_id` says the kernels' line id: the scope item's when the line has one, else the line's own (`gc_sow_line_of`), never the change order's, which B6-a's own note named.
- **`gc_back_charges.taken_draw_id`** gains its foreign key to `gc_draws`, and `authenticated` may update it with `taken_on`.
- **The office's presses**, `SECURITY INVOKER`, revoked from `PUBLIC` and `anon` and granted to `authenticated`:
  - `gc_draw_came_in(p_package_id uuid, p jsonb)` records a pay application that came by email or on paper, by the trade's own rules, with its Drive link. Its claim is their report, and it keeps their pay application promise.
  - `gc_approve_draw(p_draw_id uuid)`, `gc_approve_draw_less(p_draw_id uuid, p_we_approve jsonb, p_note text)`, `gc_send_draw_back(p_draw_id uuid, p_we_see jsonb, p_note text)` and `gc_pay_draw(p_draw_id uuid)` walk it.
  - `gc_draw_waiver_in(p_draw_id uuid)` records an unconditional waiver that came in, for a paid draw.
  - `gc_take_back_charge(p_charge_id uuid, p_draw_id uuid)` takes a back-charge off an approved, unpaid draw.
  - `gc_send_trade_change(p_change_order_id uuid)` sends a signed change order to its trade.
- **The trade's presses**, the service role's only, refusing with keys as the Portal's P2a verbs do:
  - `gc_trade_sow_report(p_company_id uuid, p_package_id uuid, p_line uuid, p_pct numeric)` reports a line, never below billed, and sets its bar's real days where none is recorded.
  - `gc_trade_pay_app(p_company_id uuid, p_package_id uuid, p_app jsonb)` sends a pay application.
  - `gc_trade_unconditional_waiver(p_company_id uuid, p_draw_id uuid)` signs the waiver for a paid draw.
  - `gc_trade_sign_change(p_company_id uuid, p_change_order_id uuid)` signs a change into a line of the statement of work. A credit is reported done.
  - Their keys: `notFound`, `notOnTrade`, `sowNotSigned`, `jobNotBuilding`, `drawWaiting`, `badRequest`, `nameNeeded`, `nothingToBill`, `splitLine`, `notPaidYet` and `alreadySigned`. The new ones wait in WAITING as `'P5'`.
- **The helpers**: `gc_sow_line_of`, `gc_draw_claim` and `gc_draw_money` read only. `gc_draw_waiver_signed` records a waiver and keeps the closeout promise when it was the last paper owed. All four are granted to `authenticated` and the service role.

The four tables are dev only (one `_dev` policy each, `is_dev()`), with the read-only blocks and the twin fence. Building's door opens them to the money roles (decision 4). `anon` has no grant. A report keeps no UPDATE or DELETE privilege.

Apply order: after the four above. The new tables are empty. Two constraints change on the Board's and the Portal's dev-only tables: the check on `gc_sow_lines` and the foreign key on `gc_back_charges`. Each locks its table briefly behind `lock_timeout 3s`. The rest is `CREATE OR REPLACE`. It is idempotent.

**Before the push**, the SQL bed (`scripts/pgtest-gc-building.sh`, `npm run test:pg:gc-building`; GitHub's runners run it from `.github/workflows/sql-beds.yml` on this PR) applies every migration to the Supabase Postgres image, applies Building's presses a second time, and plays every scenario in `supabase/tests/gc_building`, `60_draws.sql` among them:
- a trade's pay application, the office's, one sent back and sent again, one approved for less, each paid, each waiver in;
- every draw's money against the kernel's, a credit's included;
- a back-charge taken off, and the change order signed into a line;
- the trade's reports, and the real days they set;
- each refusal in its words or its key, and a trainee, a twin, an estimator and a signed-in caller of the trade's presses.
It ends `gc_building PASSED`.

## Verify after the push

1. **The tables, their policies, and the functions with invoker's rights and the right callers.**

   ```sql
   SELECT c.relname, c.relrowsecurity, (SELECT string_agg(polname, ',') FROM pg_policy WHERE polrelid = c.oid) AS policies
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   WHERE c.relname IN ('gc_draws', 'gc_draw_lines', 'gc_sow_line_reports', 'gc_change_order_trade_sends') ORDER BY 1;
   SELECT p.proname, p.prosecdef AS definer,
     has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can,
     has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_can,
     has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_can
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname IN ('gc_sow_line_of', 'gc_draw_claim', 'gc_draw_money', 'gc_draw_came_in', 'gc_approve_draw', 'gc_approve_draw_less',
     'gc_send_draw_back', 'gc_pay_draw', 'gc_draw_waiver_signed', 'gc_draw_waiver_in', 'gc_take_back_charge', 'gc_send_trade_change',
     'gc_trade_sow_report', 'gc_trade_pay_app', 'gc_trade_unconditional_waiver', 'gc_trade_sign_change')
   ORDER BY p.proname;
   SELECT conname FROM pg_constraint WHERE conname IN ('gc_sow_lines_credit_by_change_order', 'gc_sow_lines_amount_not_negative', 'gc_back_charges_taken_draw_fkey');
   ```

   Expect:
   - four tables with row security on, each with its `_dev` policy and the read-only and twin policies;
   - sixteen functions, every `definer` false and every `anon_can` false;
   - `signed_in_can` true on all but the four `gc_trade_*`, which only `service_can`;
   - `gc_sow_lines_credit_by_change_order` and `gc_back_charges_taken_draw_fkey`, and no `gc_sow_lines_amount_not_negative`.

2. **The money, read only, as a dev**: `gc_draw_money` on a signed statement of work if one exists on prod, else none. With no signed statement of work on prod (call 6), the presses wait for P2c, and step 3 is the bed's.

3. **One pay application on "GC test project, delete me"** once a statement of work there is signed (P2c), inside one transaction that rolls back unless Grace says keep it: record one that came by email, send it back, record it again, approve it for less, mark it paid, record the waiver.

4. **A training account's call is refused in words.** As the training-mode user, `gc_draw_came_in` gives *A training account cannot record a pay application.* (`42501`).

5. **The trade's presses are the service role's only.** As a dev, `gc_trade_pay_app` gives *permission denied for function gc_trade_pay_app*.

## Rollback

```sql
DROP FUNCTION IF EXISTS public.gc_trade_sign_change(uuid, uuid);
DROP FUNCTION IF EXISTS public.gc_trade_unconditional_waiver(uuid, uuid);
DROP FUNCTION IF EXISTS public.gc_trade_pay_app(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.gc_trade_sow_report(uuid, uuid, uuid, numeric);
DROP FUNCTION IF EXISTS public.gc_send_trade_change(uuid);
DROP FUNCTION IF EXISTS public.gc_take_back_charge(uuid, uuid);
DROP FUNCTION IF EXISTS public.gc_draw_waiver_in(uuid);
DROP FUNCTION IF EXISTS public.gc_draw_waiver_signed(uuid);
DROP FUNCTION IF EXISTS public.gc_pay_draw(uuid);
DROP FUNCTION IF EXISTS public.gc_send_draw_back(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.gc_approve_draw_less(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.gc_approve_draw(uuid);
DROP FUNCTION IF EXISTS public.gc_draw_came_in(uuid, jsonb);
DROP FUNCTION IF EXISTS public.gc_draw_money(uuid, integer, jsonb);
DROP FUNCTION IF EXISTS public.gc_draw_claim(uuid, jsonb);
DROP FUNCTION IF EXISTS public.gc_sow_line_of(uuid, uuid);
ALTER TABLE public.gc_back_charges DROP CONSTRAINT IF EXISTS gc_back_charges_taken_draw_fkey;
REVOKE UPDATE (taken_draw_id, taken_on) ON TABLE public.gc_back_charges FROM authenticated;
DROP TABLE IF EXISTS public.gc_change_order_trade_sends;
DROP TABLE IF EXISTS public.gc_sow_line_reports;
DROP TABLE IF EXISTS public.gc_draw_lines;
DROP TABLE IF EXISTS public.gc_draws;
-- Only once no change order's line is a credit:
ALTER TABLE public.gc_sow_lines DROP CONSTRAINT IF EXISTS gc_sow_lines_credit_by_change_order;
ALTER TABLE public.gc_sow_lines ADD CONSTRAINT gc_sow_lines_amount_not_negative CHECK (amount >= 0);
```

No screen calls them until U6b, so nothing else changes.

## Status

Written for the Building lane's U6a; not applied. The lead pushes it after the merge and records here what steps 1 to 5 said.
````

## U6b: the Draws window, the mapper and the io

**The window**, `src/components/gc/GcDrawsWindow.tsx`, ported from the prototype's `GcDrawsTab` (`GcOfficeTabs.tsx`,
about 190 lines) with `GcBuildingSendBack` (140), `GcBuildingPayDays` and To pay (73), `GcBuildingChanges` (38),
`GcBuildingBackCharges` (188), and the office's read-only half of `GcBuildingPayApp.tsx`'s pay application window:
- It opens from **Draws** on a building job's card, at `?draws=<projectId>`, after RFIs, behind `canUseGcBuilding`
  and `canSeeGcMoney`, so it needs no new gate at Building's door.
- **To pay**: the approved draws and when each is due (`drawsToPay`, `drawPayDays`).
- One card per trade with a signed statement of work: the contract, billed, paid, retainage held and left to bill;
  each line's reported and billed bar; each draw with **Approve**, **Approve less** and **Send back** while it waits,
  **Mark paid** once approved, and its pay application to read; the pay applications sent back; the signed change
  orders to send; and the back-charges to keep, drop or take off a draw.
- **A pay application came by email**: each line's percent (starting from their report), the stored dollars, the
  period, who signed and their title, and its Drive link (checked by `checkDriveAccess`, a warning and never a stop).
- **Their unconditional waiver came in** on a paid draw.
- **Approve** is held by the company's papers (`partnerBlockers`: the master agreement, the insurance certificate,
  the W-9), as in the prototype. They read B6-b-ii's papers, so until that mapper is on main every company reads as
  missing them and Approve waits with their words.
- Left on the spike: the trade's half (`GcPortalPay`, the pay application's door), the Portal's P5c.

**The mapper**, `src/lib/gc/drawRows.ts`: `withDraws(state, tables)` lays the money over `sowOf`'s statements of work
(`boardProjectFromView`), and `ChangeOrder.tradeChange` over the change orders.

| Kernel field | From |
|---|---|
| `SovLine.pctReported` | the line's newest `gc_sow_line_reports` row |
| `SovLine.pctBilled` | the most an approved or paid draw's `gc_draw_lines.to_pct` took it to |
| `Sow.draws` | `gc_draws` that stand, with their lines by the kernels' ids, `payApp` from the words, `asked`, the days, and `backCharges` from the charges taken off each (its `net` less them, as `takeBackCharge` leaves it) |
| `Sow.sentBack` | `gc_draws` sent back: the draw as it went, the day, the note, and each line's `we_see` |
| `Sow.backCharges` | `gc_back_charges` on the statement of work, as the portal's mapper reads them |
| `ChangeOrder.tradeChange` | `gc_change_order_trade_sends`: sent, signed, and the line's kernel id |

Each draw's file and who of ours recorded it ride beside the kernel's shape, as U4b's round extras do. With the draws
real, Owner Billing's Money by trade, its forecast, the customer's bill's trade lines and owner closeout read them: the
page lays `withDraws` under `boardWithChanges` (Helper 15's seam).

**The io**, `src/lib/gc/drawsIo.ts`: `loadGcDraws(projectIds)` reads the four tables and the charges in one round, and
one function per press.

**The emails to the trade**, through `gc-trade-email`: `paid` (Mark paid), `less` (Approve less) and `change` (a
change sent to them). The kinds are in its `KIND_GROUP` and `gc_trade_messages`' check already. Their words lift
from the spike's `gcPortal.ts` with the Portal (Helper 13). Each live send waits for Grace's yes.

**The guide** *pay a trade's draw* (`roles: dev` until Building's door).

**U6b's tests**: `drawRows.test.ts` (Fair Oaks D's statements of work and draws through rows and back, the kernels'
words the same), `GcDrawsWindow.render.test.tsx` (each draw's presses, the came-in form, the blockers, plain words),
and the page's cases.

## U6c: closeout's presses (amendment 2)

One migration, `<stamp>_gc_trade_closeout.sql`, and the kernel's line 7 fix. It needs U6a on prod. The closeout
window is U6d.

**What it adds:**
- `gc_projects.closed_on` (decision 12), only on a closed job (`gc_projects_closed_on_when_closed`).
- Three read-only helpers:
  - `gc_retainage_held` (`retainageHeldNow`);
  - `gc_sow_all_billed` (`workAllBilled`);
  - `gc_owner_retainage_paid_on` (`ownerRetainagePaidOn` by `billMoney`'s rule, word for word, which Helper 15
    keeps equal on their side).
- `gc_accept_work`: once every line is billed and nothing on the trade's punch list lacks its check. That is
  `punchClear` in SQL, Helper 14's rule: no status column, done is `checked_on` set.
- The final pay application, both ways in, through one shared `gc_final_pay_app_ask`:
  - its money is the retainage held, so a back-charge taken off a draw is never paid back;
  - with no waiver owed, it keeps the closeout promise (`tradeSendFinalPayApp`'s rule);
  - the trade's `gc_trade_final_pay_app` is the service role's only;
  - the office's `gc_final_pay_app_came_in` maps the shared keys to its own words;
  - a signed-in caller records it only as themselves.
- `gc_approve_retainage`: 10 days after the customer pays our final pay application (`TRADE_RETAINAGE_WAIT_DAYS`).
  U6a's `gc_pay_draw` pays it, and U6a's waivers take its unconditional final release.
- `gc_trade_change_signed_in` (amendment 3): a change the trade signed on paper or by email, recorded by the office, as
  a pay application and a waiver that came in are. It makes the same line as `gc_trade_sign_change`, with a credit
  reported done, and keeps who of ours recorded it and the file it came as (three new columns on
  `gc_change_order_trade_sends`). Without it a change sent before P5c could never be signed, leaving its credit line
  and the statement of work stuck.
- `gc_close_job`: the stage `closed` and `closed_on` today. It writes the office's `gc_projects`, so it names the dev
  while Building is built. Building's door makes it the money roles' (`gc_money_team()`), with the tables. The window
  offers it once every trade is closed out (`jobCloseout`), as the prototype's reducer trusts its screen.

**New trade keys**, in WAITING as `'P5'`: `finalSent` and `finalNotYet`. The rest are U6a's or the portal's
already: `notFound`, `notOnTrade`, `sowNotSigned`, `jobNotBuilding`, `drawWaiting`, `nothingToBill`, `badRequest`,
`nameNeeded`.

**The kernel's line 7.** `payApplication`'s previous certificates sum each earlier draw's `net`. `takeBackCharge`
lowers a draw's `net` by the charge, so the retainage release (`finalPayApplication`'s line 8) asked for the charge
back. Line 7 now counts what each earlier application was certified for, before a charge came off what we paid:

```ts
  // Line 7: what earlier applications were certified for, before any back-charge came off what we paid.
  const previousCertificates = sow.draws
    .filter((d) => d.number < number)
    .reduce((s, d) => s + d.net + (d.backCharges ?? []).reduce((t, b) => t + b.amount, 0), 0)
```

Its test in `building.direct.test.ts`, on the scenario's statement of work: with a $500 charge off draw 2, the release
is $3,000, equal to `retainageHeldNow` (main today: $3,500). Owner Billing reads closeout only through
`tradeCloseout`, which does not read line 7. The trade's G702 in the pay application window shows the new line 7.

**The refusals, in plain words:** 46 sentences, 0 failing (`plainWordsFailures`, the office's mapped words
included).

### The SQL as it will be (U6c)

`supabase/migrations/<stamp>_gc_trade_closeout.sql`. The stamp, U6a's stamp and `v2.NNNN` are the only things that
change at the cut.

```sql
SET lock_timeout = '3s';

-- GC mode, the real build, the Building lane's U6c (v2.NNNN): closeout on real data. Once every line of a trade's
-- statement of work is billed, we accept the work when its punch list is done; the trade asks for the retainage we
-- hold with its final pay application; we approve it 10 days after the customer pays us ours and pay it; its
-- unconditional final release keeps the promise of its closeout papers (U6a's gc_draw_waiver_signed). Then we close
-- the job. A change the trade signed on paper is recorded by the office, as a pay application and a waiver that came
-- in are, so its line never waits for the portal. Each refuses in words what the prototype's reducer refuses
-- (acceptWork, tradeSendFinalPayApp, approveRetainage, closeJob, tradeSignChange). The release is the retainage held
-- (retainageHeldNow), so a back-charge taken off a draw is never paid back; the kernels' finalPayApplication says the
-- same once its line 7 counts what was certified before the charges. The office's presses are SECURITY INVOKER, so
-- RLS decides who may: dev only until Building's door, then the money roles (decision 4). Closing a job writes the
-- office's gc_projects, so it names the dev until that door. The trade's press is the service role's only, with keys
-- as the Portal's P2a verbs. Plan: to-dos/gc-mode/mockups/building-u6.md on spike/gc-mode. The draws: U6a
-- (<U6a stamp>). The punch list: U1 (20261008030000). Our bills to the customer: 20261008010000 and 20261009200000.

-- The day we closed the job (decision 12), set with the stage `closed` by gc_close_job.
ALTER TABLE public.gc_projects ADD COLUMN IF NOT EXISTS closed_on date;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_projects_closed_on_when_closed' AND conrelid = 'public.gc_projects'::regclass) THEN
    ALTER TABLE public.gc_projects ADD CONSTRAINT gc_projects_closed_on_when_closed CHECK (closed_on IS NULL OR stage = 'closed');
  END IF;
END $$;

COMMENT ON COLUMN public.gc_projects.closed_on IS
  'GC mode (v2.NNNN, Building U6c): the day we closed the job (GcProject.closedOn), set with the stage closed by gc_close_job. Null: not closed, or closed before U6c.';

-- A change the trade signed on paper or by email: who of ours recorded it, and the file it came as. Null: signed in the
-- portal (gc_trade_sign_change), or not signed yet.
ALTER TABLE public.gc_change_order_trade_sends
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS drive_url text;

COMMENT ON COLUMN public.gc_change_order_trade_sends.recorded_by IS
  'GC mode (v2.NNNN, Building U6c): who of ours recorded the trade''s signature on paper or by email (gc_trade_change_signed_in). Null: signed in the portal, or not signed yet.';

-- What we hold on a trade (retainageHeldNow): the retainage on every approved or paid draw, less a release once paid.
CREATE OR REPLACE FUNCTION public.gc_retainage_held(p_sow_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(sum(retainage) FILTER (WHERE NOT final AND status IN ('approved', 'paid')), 0)
       - coalesce(sum(net) FILTER (WHERE final AND status = 'paid'), 0)
  FROM public.gc_draws WHERE sow_id = p_sow_id
$$;

-- Every line billed (workAllBilled): each line of the statement of work at 100% on an approved or paid draw.
CREATE OR REPLACE FUNCTION public.gc_sow_all_billed(p_sow_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*) > 0 AND bool_and(coalesce(b.pct, 0) >= 100)
  FROM public.gc_sow_lines l
  LEFT JOIN LATERAL (
    SELECT max(dl.to_pct) AS pct FROM public.gc_draw_lines dl JOIN public.gc_draws d ON d.id = dl.draw_id
    WHERE dl.sow_line_id = l.id AND d.status IN ('approved', 'paid') AND NOT d.final
  ) b ON true
  WHERE l.sow_id = p_sow_id
$$;

-- The day the customer paid us the retainage they held (ownerRetainagePaidOn): our final pay application's bill,
-- paid on the day its payments reach its amount, or on its last payment's day once it is marked paid for less
-- (billMoney in src/lib/gc/ownerBillingRows.ts, word for word; Owner Billing keeps the two equal). Null: not yet.
CREATE OR REPLACE FUNCTION public.gc_owner_retainage_paid_on(p_project_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH bill AS (
    SELECT i.id, i.amount, i.status
    FROM public.gc_owner_pay_apps a JOIN public.jobs_ledger_invoices i ON i.id = a.invoice_id
    WHERE a.project_id = p_project_id AND a.final
    ORDER BY a.number DESC LIMIT 1
  ),
  paid AS (
    SELECT p.paid_on, sum(p.amount) OVER (ORDER BY p.paid_on ROWS UNBOUNDED PRECEDING) AS so_far
    FROM public.jobs_ledger_payments p JOIN bill b ON p.invoice_id = b.id
    WHERE p.paid_on IS NOT NULL
  )
  SELECT coalesce(
    (SELECT min(p.paid_on) FROM paid p CROSS JOIN bill b WHERE p.so_far >= b.amount - 0.005),
    (SELECT max(p.paid_on) FROM paid p CROSS JOIN bill b WHERE b.status = 'paid')
  )
$$;

-- Accept a trade's work (acceptWork): once every line is billed, and while nothing on its punch list waits to be
-- fixed or checked (punchClear: no item on the trade without its check). Not twice.
CREATE OR REPLACE FUNCTION public.gc_accept_work(p_package_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sow public.gc_sows%ROWTYPE;
  v_left integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot accept a trade''s work.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot accept a trade''s work.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id FOR UPDATE;
  IF NOT FOUND OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'Their statement of work is not signed yet.' USING ERRCODE = 'P0001';
  END IF;
  IF v_sow.accepted_on IS NOT NULL THEN
    RAISE EXCEPTION 'We accepted their work already.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.gc_sow_all_billed(v_sow.id) THEN
    RAISE EXCEPTION 'Accept the work once every line is billed.' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_left FROM public.gc_punch_items WHERE package_id = p_package_id AND checked_on IS NULL;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'Their punch list has % % to fix or check first.', v_left, CASE WHEN v_left = 1 THEN 'item' ELSE 'items' END USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_sows SET accepted_on = public.app_today() WHERE id = v_sow.id;
  RETURN public.app_today();
END;
$$;

-- A final pay application (tradeSendFinalPayApp): the retainage we hold, with the conditional final release of lien.
-- Its gross is none, its retainage the release taken back, its net the release. The rules both ways in share it:
-- every line billed, the work accepted, no release asked yet, no draw waiting, and retainage held. With no waiver
-- owed, it keeps the promise of their closeout papers. Returns the draw, or raises its key and words.
CREATE OR REPLACE FUNCTION public.gc_final_pay_app_ask(p_sow_id uuid, p jsonb, p_recorded_by uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sow public.gc_sows%ROWTYPE;
  v_project uuid;
  v_period date;
  v_signed_by text := btrim(coalesce(p->>'signedBy', ''));
  v_held numeric;
  v_number integer;
  v_id uuid;
BEGIN
  -- One of ours records it as themselves; the portal (the service role, no one signed in) records no one.
  IF auth.uid() IS DISTINCT FROM p_recorded_by THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Record it as yourself.';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE id = p_sow_id FOR UPDATE;
  SELECT project_id INTO v_project FROM public.gc_trade_packages WHERE id = v_sow.package_id;
  IF EXISTS (SELECT 1 FROM public.gc_draws WHERE sow_id = p_sow_id AND final AND status <> 'sent_back') THEN
    RAISE EXCEPTION 'finalSent' USING ERRCODE = 'P0001', DETAIL = 'The final pay application went already.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_draws WHERE sow_id = p_sow_id AND status = 'requested') THEN
    RAISE EXCEPTION 'drawWaiting' USING ERRCODE = 'P0001', DETAIL = 'The last pay application is still with us.';
  END IF;
  IF NOT public.gc_sow_all_billed(p_sow_id) OR v_sow.accepted_on IS NULL THEN
    RAISE EXCEPTION 'finalNotYet' USING ERRCODE = 'P0001', DETAIL = 'The final pay application opens once every line is billed and the work is accepted.';
  END IF;
  v_held := public.gc_retainage_held(p_sow_id);
  IF v_held <= 0 THEN
    RAISE EXCEPTION 'nothingToBill' USING ERRCODE = 'P0001', DETAIL = 'No retainage is held to pay back.';
  END IF;
  BEGIN
    v_period := nullif(btrim(coalesce(p->>'periodTo', '')), '')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    v_period := NULL;
  END;
  IF v_period IS NULL THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'The pay application needs its period.';
  END IF;
  IF v_signed_by = '' THEN
    RAISE EXCEPTION 'nameNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type the name of who signs it.';
  END IF;
  SELECT count(*) + 1 INTO v_number FROM public.gc_draws WHERE sow_id = p_sow_id AND status <> 'sent_back';
  INSERT INTO public.gc_draws (sow_id, number, requested_on, gross, retainage, net, final, period_to, address, license, signed_by, signed_title, signed_on, file_name, drive_url, recorded_by)
  VALUES (
    p_sow_id, v_number, public.app_today(), 0, -v_held, v_held, true,
    v_period, btrim(coalesce(p->>'address', '')), btrim(coalesce(p->>'license', '')), v_signed_by,
    btrim(coalesce(p->>'signedTitle', '')), public.app_today(),
    nullif(btrim(coalesce(p->>'fileName', '')), ''), nullif(btrim(coalesce(p->>'driveUrl', '')), ''), p_recorded_by
  )
  RETURNING id INTO v_id;
  IF NOT EXISTS (SELECT 1 FROM public.gc_draws WHERE sow_id = p_sow_id AND status = 'paid' AND waiver = 'conditional') THEN
    PERFORM public.gc_keep_promises(v_sow.company_id, 'closeout', v_project, v_sow.package_id, public.app_today());
  END IF;
  RETURN v_id;
END;
$$;

-- The trade's final pay application from its portal: the company on its statement of work, on a job being built.
CREATE OR REPLACE FUNCTION public.gc_trade_final_pay_app(p_company_id uuid, p_package_id uuid, p_app jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
BEGIN
  SELECT g.stage INTO v_stage
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id;
  IF v_stage IS NULL OR v_sow.id IS NULL THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No statement of work for that trade.';
  END IF;
  IF v_sow.company_id IS DISTINCT FROM p_company_id
     OR NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = p_package_id AND awarded_invite_id = v_sow.invite_id) THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can send its pay application.';
  END IF;
  IF v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'sowNotSigned' USING ERRCODE = 'P0001', DETAIL = 'Sign your statement of work first.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'Pay applications open once we are building the job.';
  END IF;
  RETURN public.gc_final_pay_app_ask(v_sow.id, p_app, NULL);
END;
$$;

-- A final pay application that came by email or on paper (new beside the prototype, as U6a's came-in is), in the
-- office's words.
CREATE OR REPLACE FUNCTION public.gc_final_pay_app_came_in(p_package_id uuid, p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
  v_detail text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a pay application.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a pay application.' USING ERRCODE = '42501';
  END IF;
  SELECT g.stage INTO v_stage
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trade with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'Pay applications are for a job we are building.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id;
  IF NOT FOUND OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'Their statement of work is not signed yet.' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    RETURN public.gc_final_pay_app_ask(v_sow.id, p, v_uid);
  EXCEPTION WHEN raise_exception THEN
    -- The shared rules' keys, in the office's words.
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    RAISE EXCEPTION '%', CASE SQLERRM
      WHEN 'finalSent' THEN 'Their final pay application is in already.'
      WHEN 'drawWaiting' THEN 'A pay application is waiting on us. Approve it or send it back first.'
      WHEN 'finalNotYet' THEN 'The final pay application comes once every line is billed and we accept the work.'
      WHEN 'nothingToBill' THEN 'We hold no retainage on this trade to pay back.'
      WHEN 'badRequest' THEN 'Say the day the pay application runs to.'
      WHEN 'nameNeeded' THEN 'Say who signed it.'
      ELSE coalesce(nullif(v_detail, ''), SQLERRM) END USING ERRCODE = 'P0001';
  END;
END;
$$;

-- Approve the retainage release (approveRetainage): 10 days after the customer pays us ours
-- (TRADE_RETAINAGE_WAIT_DAYS, tradeCloseout's canPay).
CREATE OR REPLACE FUNCTION public.gc_approve_retainage(p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
  v_project uuid;
  v_paid date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot approve a pay application.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot approve a pay application.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pay application with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v.final THEN
    RAISE EXCEPTION 'Only a retainage release is approved here.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'requested' THEN
    RAISE EXCEPTION 'Only a pay application waiting on us is approved.' USING ERRCODE = 'P0001';
  END IF;
  SELECT k.project_id INTO v_project FROM public.gc_sows s JOIN public.gc_trade_packages k ON k.id = s.package_id WHERE s.id = v.sow_id;
  v_paid := public.gc_owner_retainage_paid_on(v_project);
  IF v_paid IS NULL THEN
    RAISE EXCEPTION 'The customer has not paid us our retainage yet.' USING ERRCODE = 'P0001';
  END IF;
  IF public.app_today() < v_paid + 10 THEN
    RAISE EXCEPTION 'We pay their retainage from %, 10 days after the customer paid us ours.', to_char(v_paid + 10, 'Mon FMDD') USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_draws SET status = 'approved', approved_on = public.app_today() WHERE id = p_draw_id;
  RETURN public.app_today();
END;
$$;

-- A change the trade signed on paper or by email (new beside the prototype, the office's twin of gc_trade_sign_change, as
-- the pay application's and the waiver's came-in presses are): the same line on their statement of work for what the
-- change costs us, a credit counted as done at once, and who of ours recorded it with the file it came as.
CREATE OR REPLACE FUNCTION public.gc_trade_change_signed_in(p_change_order_id uuid, p_file_name text DEFAULT NULL, p_drive_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_send public.gc_change_order_trade_sends%ROWTYPE;
  v_sow public.gc_sows%ROWTYPE;
  co public.gc_change_orders%ROWTYPE;
  v_line uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a signature.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a signature.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_send FROM public.gc_change_order_trade_sends WHERE change_order_id = p_change_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Send the change to the trade first.' USING ERRCODE = 'P0001';
  END IF;
  IF v_send.signed_on IS NOT NULL THEN
    RAISE EXCEPTION 'They signed it already.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE id = v_send.sow_id;
  SELECT * INTO co FROM public.gc_change_orders WHERE id = p_change_order_id;
  -- The same steps as gc_trade_sign_change: the change's line, and a credit reported done.
  INSERT INTO public.gc_sow_lines (sow_id, position, label, amount, change_order_id)
  VALUES (
    v_sow.id,
    (SELECT coalesce(max(position), -1) + 1 FROM public.gc_sow_lines WHERE sow_id = v_sow.id),
    'Change order ' || co.number || ': ' || co.description,
    co.cost,
    co.id
  )
  RETURNING id INTO v_line;
  IF co.cost < 0 THEN
    INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id, recorded_by)
    VALUES (v_line, 100, public.app_today(), v_sow.company_id, v_uid);
  END IF;
  UPDATE public.gc_change_order_trade_sends
  SET signed_on = public.app_today(), sow_line_id = v_line, recorded_by = v_uid,
      file_name = nullif(btrim(coalesce(p_file_name, '')), ''), drive_url = nullif(btrim(coalesce(p_drive_url, '')), '')
  WHERE change_order_id = p_change_order_id;
  RETURN v_line;
END;
$$;

-- Close the job (closeJob): one we are building leaves Building for its own section on the board. The window offers
-- it once every trade is closed out (jobCloseout), as the prototype's reducer trusts its screen. It writes the
-- office's gc_projects, so it names the dev while Building is built; Building's door names the money roles.
CREATE OR REPLACE FUNCTION public.gc_close_job(p_project_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_stage text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot close a job.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot close a job.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Closing a job is a dev''s while Building is built.' USING ERRCODE = '42501';
  END IF;
  SELECT stage INTO v_stage FROM public.gc_projects WHERE project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No GC project with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage = 'closed' THEN
    RAISE EXCEPTION 'This job is closed already.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'Only a job we are building is closed.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_projects SET stage = 'closed', closed_on = public.app_today() WHERE project_id = p_project_id;
  RETURN public.app_today();
END;
$$;

COMMENT ON FUNCTION public.gc_retainage_held(uuid) IS
  'GC mode (v2.NNNN, Building U6c): what we hold on a trade (retainageHeldNow): the retainage on approved and paid draws, less a release once paid.';
COMMENT ON FUNCTION public.gc_sow_all_billed(uuid) IS
  'GC mode (v2.NNNN, Building U6c): every line of the statement of work at 100% on an approved or paid draw (workAllBilled).';
COMMENT ON FUNCTION public.gc_owner_retainage_paid_on(uuid) IS
  'GC mode (v2.NNNN, Building U6c): the day the customer paid our final pay application''s bill (ownerRetainagePaidOn by billMoney''s rule in src/lib/gc/ownerBillingRows.ts, kept equal with Owner Billing). Null: not yet.';
COMMENT ON FUNCTION public.gc_accept_work(uuid) IS
  'GC mode (v2.NNNN): accept a trade''s work (acceptWork) once every line is billed and its punch list is done (no item without its check). Not twice. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_final_pay_app_ask(uuid, jsonb, uuid) IS
  'GC mode (v2.NNNN): the final pay application''s rules, shared by the trade''s and the office''s: the retainage held, once every line is billed and the work is accepted, one at a time; it keeps the closeout promise when no waiver is owed. Raises keys. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_trade_final_pay_app(uuid, uuid, jsonb) IS
  'GC mode (v2.NNNN): the trade''s final pay application (tradeSendFinalPayApp): notFound, notOnTrade, sowNotSigned, jobNotBuilding, finalSent, drawWaiting, finalNotYet, nothingToBill, badRequest, nameNeeded. Service role only.';
COMMENT ON FUNCTION public.gc_final_pay_app_came_in(uuid, jsonb) IS
  'GC mode (v2.NNNN): record a final pay application that came by email or on paper, by the trade''s own rules, in the office''s words. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_approve_retainage(uuid) IS
  'GC mode (v2.NNNN): approve the retainage release (approveRetainage) 10 days after the customer paid us ours. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_trade_change_signed_in(uuid, text, text) IS
  'GC mode (v2.NNNN): a change the trade signed on paper or by email, recorded by the office (the twin of gc_trade_sign_change): its line on their statement of work, a credit done at once, who recorded it and the file. Not before it was sent, nor twice. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_close_job(uuid) IS
  'GC mode (v2.NNNN): close a job we are building (closeJob): the stage closed and closed_on today. A dev''s while Building is built. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_retainage_held(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_retainage_held(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gc_sow_all_billed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_sow_all_billed(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gc_owner_retainage_paid_on(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_owner_retainage_paid_on(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gc_final_pay_app_ask(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_final_pay_app_ask(uuid, jsonb, uuid) TO authenticated, service_role;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.gc_accept_work(uuid)', 'public.gc_final_pay_app_came_in(uuid, jsonb)', 'public.gc_approve_retainage(uuid)',
    'public.gc_trade_change_signed_in(uuid, text, text)', 'public.gc_close_job(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
  -- Only the service role: the portal's submit function, after it has turned a link into its company.
  EXECUTE 'REVOKE ALL ON FUNCTION public.gc_trade_final_pay_app(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.gc_trade_final_pay_app(uuid, uuid, jsonb) TO service_role';
END $$;
```

### The SQL tests (U6c)

U6c adds one line to `PRESSES`, `supabase/migrations/*_gc_trade_closeout.sql`, one path to `sql-beds.yml`,
`- 'supabase/migrations/*gc_trade_closeout*'`, and `finalSent` and `finalNotYet` to WAITING. Its scenario,
`supabase/tests/gc_building/70_closeout.sql`, inserts the customer's bills and payments directly (a billing job, its
bill and the payments on it). The real bed on the PR checks that the Pipeline's own triggers take them as written. Each
trade step runs signed out, as the portal's calls are:

```sql
-- Closeout (v2.NNNN, the Building lane's U6c): every line billed, the work accepted once the punch list is done, the
-- trade's final pay application for the retainage we hold (never less a back-charge taken off a draw), its release
-- approved 10 days after the customer pays us ours (the day by billMoney's rule), paid, its unconditional final
-- release keeping the promise of the closeout papers, and the job closed. A change the trade signed on paper,
-- recorded by the office into a line of its statement of work. Each press refuses in words, or the trade's in keys,
-- what the prototype's reducer refuses. A training account, a digital twin and a role outside Building's dev door are
-- refused; the trade's press is the service role's only. Presses run through RLS, the fixture made as postgres;
-- everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "gc_building PASSED". See scripts/pgtest-gc-building.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000acd01', 'dev@closeout.test'),
  ('00000000-0000-0000-0000-0000000acd02', 'trainee@closeout.test'),
  ('00000000-0000-0000-0000-0000000acd03', 'twin@closeout.test'),
  ('00000000-0000-0000-0000-0000000acd04', 'estimator@closeout.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000acd01', 'dev@closeout.test', 'Closeout Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000acd02', 'trainee@closeout.test', 'Closeout Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000acd03', 'twin@closeout.test', 'Closeout Twin', 'dev'),
  ('00000000-0000-0000-0000-0000000acd04', 'estimator@closeout.test', 'Closeout Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000acd02';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000acd03';

-- Three GC jobs. A is being built: Concrete awarded to Ridgeway Concrete with a signed statement of work at 10%
-- retainage (Footings $12,000, Slab $18,000), and our own Plumbing. B is still bidding. C is being built, for the
-- customer's bill paid for less.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000acc01', 'Closeout Test Owner', '00000000-0000-0000-0000-0000000acd01');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000aca01', 'Closeout test A', '00000000-0000-0000-0000-0000000acc01'),
  ('00000000-0000-0000-0000-0000000aca02', 'Closeout test B', '00000000-0000-0000-0000-0000000acc01'),
  ('00000000-0000-0000-0000-0000000aca03', 'Closeout test C', '00000000-0000-0000-0000-0000000acc01');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES
  ('00000000-0000-0000-0000-0000000aca01', 'building', public.app_today() - 90),
  ('00000000-0000-0000-0000-0000000aca02', 'bidding', NULL),
  ('00000000-0000-0000-0000-0000000aca03', 'building', public.app_today() - 120);
INSERT INTO public.gc_companies (id, name, trades) VALUES ('00000000-0000-0000-0000-0000000ace01', 'Ridgeway Concrete', ARRAY['Concrete']);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000acb01', '00000000-0000-0000-0000-0000000aca01', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000acb02', '00000000-0000-0000-0000-0000000aca01', 'Plumbing', 1, true),
  ('00000000-0000-0000-0000-0000000acb03', '00000000-0000-0000-0000-0000000aca02', 'Electrical', 0, false);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000acf01', '00000000-0000-0000-0000-0000000acb01', '00000000-0000-0000-0000-0000000ace01');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000acf01', awarded_on = public.app_today() - 85 WHERE id = '00000000-0000-0000-0000-0000000acb01';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-0000000ac101', '00000000-0000-0000-0000-0000000acb01', 'Footings', 0),
  ('00000000-0000-0000-0000-0000000ac102', '00000000-0000-0000-0000-0000000acb01', 'Slab', 1);
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-0000000ac201', '00000000-0000-0000-0000-0000000acb01', '00000000-0000-0000-0000-0000000acf01', '00000000-0000-0000-0000-0000000ace01', 'signed', 30000, 10, public.app_today() - 82, public.app_today() - 80);
INSERT INTO public.gc_sow_lines (id, sow_id, position, label, amount, scope_item_id) VALUES
  ('00000000-0000-0000-0000-0000000ac301', '00000000-0000-0000-0000-0000000ac201', 0, 'Footings', 12000, '00000000-0000-0000-0000-0000000ac101'),
  ('00000000-0000-0000-0000-0000000ac302', '00000000-0000-0000-0000-0000000ac201', 1, 'Slab', 18000, '00000000-0000-0000-0000-0000000ac102');
-- Its draws so far: 1 paid with its unconditional waiver in (Footings and Slab to 50%), and 2 approved (Footings to
-- 100%, Slab to 90%), with a $500 back-charge taken off it.
INSERT INTO public.gc_draws (id, sow_id, number, requested_on, status, gross, retainage, net, waiver, waiver_on, approved_on, paid_on, period_to, signed_by, signed_on) VALUES
  ('00000000-0000-0000-0000-0000000ac401', '00000000-0000-0000-0000-0000000ac201', 1, public.app_today() - 31, 'paid', 15000, 1500, 13500, 'unconditional', public.app_today() - 27, public.app_today() - 30, public.app_today() - 28, public.app_today() - 31, 'Pat Ridgeway', public.app_today() - 31),
  ('00000000-0000-0000-0000-0000000ac402', '00000000-0000-0000-0000-0000000ac201', 2, public.app_today() - 6, 'approved', 13200, 1320, 11880, 'conditional', NULL, public.app_today() - 5, NULL, public.app_today() - 6, 'Pat Ridgeway', public.app_today() - 6);
INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct) VALUES
  ('00000000-0000-0000-0000-0000000ac401', '00000000-0000-0000-0000-0000000ac301', 50),
  ('00000000-0000-0000-0000-0000000ac401', '00000000-0000-0000-0000-0000000ac302', 50),
  ('00000000-0000-0000-0000-0000000ac402', '00000000-0000-0000-0000-0000000ac301', 100),
  ('00000000-0000-0000-0000-0000000ac402', '00000000-0000-0000-0000-0000000ac302', 90);
INSERT INTO public.gc_back_charges (id, project_id, package_id, company_id, sow_id, amount, reason, sent_on, status, answered_on, taken_draw_id, taken_on) VALUES
  ('00000000-0000-0000-0000-0000000ac501', '00000000-0000-0000-0000-0000000aca01', '00000000-0000-0000-0000-0000000acb01', '00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000ac201', 500, 'Washout on the street', public.app_today() - 12, 'agreed', public.app_today() - 10, '00000000-0000-0000-0000-0000000ac402', public.app_today() - 4);
-- C's Masonry, awarded to Ridgeway with a signed statement of work, and two change orders the customer signed on it:
-- a $400 credit and a $900 add.
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000acb05', '00000000-0000-0000-0000-0000000aca03', 'Masonry', 0, false);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000acf03', '00000000-0000-0000-0000-0000000acb05', '00000000-0000-0000-0000-0000000ace01');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000acf03', awarded_on = public.app_today() - 110 WHERE id = '00000000-0000-0000-0000-0000000acb05';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-0000000ac105', '00000000-0000-0000-0000-0000000acb05', 'Block walls', 0);
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-0000000ac205', '00000000-0000-0000-0000-0000000acb05', '00000000-0000-0000-0000-0000000acf03', '00000000-0000-0000-0000-0000000ace01', 'signed', 20000, 10, public.app_today() - 105, public.app_today() - 100);
INSERT INTO public.gc_sow_lines (id, sow_id, position, label, amount, scope_item_id) VALUES
  ('00000000-0000-0000-0000-0000000ac305', '00000000-0000-0000-0000-0000000ac205', 0, 'Block walls', 20000, '00000000-0000-0000-0000-0000000ac105');
INSERT INTO public.gc_change_orders (id, project_id, number, description, reason, package_id, cost, price, status, sent_on, answered_on, answered_how) VALUES
  ('00000000-0000-0000-0000-0000000ad301', '00000000-0000-0000-0000-0000000aca03', 1, 'Leave out the lintel', 'owner', '00000000-0000-0000-0000-0000000acb05', -400, -440, 'signed', public.app_today() - 9, public.app_today() - 7, 'office'),
  ('00000000-0000-0000-0000-0000000ad302', '00000000-0000-0000-0000-0000000aca03', 2, 'Add a bond beam', 'field', '00000000-0000-0000-0000-0000000acb05', 900, 990, 'signed', public.app_today() - 9, public.app_today() - 7, 'office');
-- One punch item on Concrete, still to fix.
INSERT INTO public.gc_punch_items (id, project_id, package_id, text, added_on) VALUES
  ('00000000-0000-0000-0000-0000000ac601', '00000000-0000-0000-0000-0000000aca01', '00000000-0000-0000-0000-0000000acb01', 'Patch the slab edge at grid C', public.app_today() - 3);
-- Ridgeway's promise of its closeout papers.
INSERT INTO public.gc_trade_promises (id, company_id, kind, project_id, package_id, what, due_on, source) VALUES
  ('00000000-0000-0000-0000-0000000ac701', '00000000-0000-0000-0000-0000000ace01', 'closeout', '00000000-0000-0000-0000-0000000aca01', '00000000-0000-0000-0000-0000000acb01', 'the final pay application and the waivers', public.app_today() + 10, 'office');

CREATE SCHEMA gbt;
CREATE FUNCTION gbt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION gbt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- A trade's refusal: its key, and the reason in plain words the key carries.
CREATE FUNCTION gbt.trade_refused(label text, stmt text, want_key text, want_detail text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF SQLERRM IS DISTINCT FROM want_key OR v_detail IS DISTINCT FROM want_detail THEN
      RAISE EXCEPTION '% was refused as % (%), not % (%)', label, SQLERRM, v_detail, want_key, want_detail;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION gbt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
END $$;
-- A final pay application as the window or the portal sends it.
CREATE FUNCTION gbt.final(extra jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('periodTo', public.app_today()::text, 'address', '12 Mill Rd, Boerne', 'license', 'TX-4471', 'signedBy', 'Pat Ridgeway', 'signedTitle', 'Owner') || extra $$;
-- The draw that stands on Concrete by its number.
CREATE FUNCTION gbt.draw(p_number integer) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gc_draws WHERE sow_id = '00000000-0000-0000-0000-0000000ac201' AND number = p_number AND status <> 'sent_back' $$;
-- Concrete's draws: number, final, status, waiver and money.
CREATE FUNCTION gbt.draws() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg('D' || number || CASE WHEN final THEN ' release' ELSE '' END || ' ' || status || ' ' || waiver || ' '
    || trim_scale(gross) || '/' || trim_scale(retainage) || '/' || trim_scale(net), E'\n' ORDER BY number, seq)
  FROM public.gc_draws WHERE sow_id = '00000000-0000-0000-0000-0000000ac201' $$;
-- Whether Ridgeway's closeout promise is kept today, or still open.
CREATE FUNCTION gbt.promise() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN kept_on IS NULL THEN 'open' WHEN kept_on = public.app_today() THEN 'kept today' ELSE 'kept ' || kept_on END
  FROM public.gc_trade_promises WHERE id = '00000000-0000-0000-0000-0000000ac701' $$;
GRANT USAGE ON SCHEMA gbt TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, service_role;

-- The functions themselves: invoker's rights; the office's presses and the helpers for signed-in callers, the
-- trade's for the service role only. The closed day is new, and only on a closed job.
SELECT gbt.same('every function runs with the caller''s rights',
  (SELECT string_agg(DISTINCT prosecdef::text, ',') FROM pg_proc WHERE proname IN ('gc_retainage_held', 'gc_sow_all_billed', 'gc_owner_retainage_paid_on',
    'gc_accept_work', 'gc_final_pay_app_ask', 'gc_trade_final_pay_app', 'gc_final_pay_app_came_in', 'gc_approve_retainage', 'gc_close_job')),
  'false');
SELECT gbt.same('who runs each: signed out, signed in, the service role',
  (SELECT string_agg(f || ':' || has_function_privilege('anon', f, 'EXECUTE') || '/' || has_function_privilege('authenticated', f, 'EXECUTE') || '/' || has_function_privilege('service_role', f, 'EXECUTE'), ',')
   FROM unnest(ARRAY['public.gc_accept_work(uuid)', 'public.gc_approve_retainage(uuid)', 'public.gc_close_job(uuid)', 'public.gc_trade_final_pay_app(uuid, uuid, jsonb)']) f),
  'public.gc_accept_work(uuid):false/true/true,public.gc_approve_retainage(uuid):false/true/true,public.gc_close_job(uuid):false/true/true,public.gc_trade_final_pay_app(uuid, uuid, jsonb):false/false/true');
SELECT gbt.same('the day we closed a job, kept only on a closed one',
  (SELECT string_agg(conname, ',') FROM pg_constraint WHERE conname = 'gc_projects_closed_on_when_closed') || ' '
    || (SELECT count(*) FROM information_schema.columns WHERE table_name = 'gc_projects' AND column_name = 'closed_on'),
  'gc_projects_closed_on_when_closed 1');
SELECT gbt.same('what we hold before the last draw: draw 1''s and draw 2''s retainage, the charge taken off draw 2 aside',
  trim_scale(public.gc_retainage_held('00000000-0000-0000-0000-0000000ac201'))::text || ' ' || public.gc_sow_all_billed('00000000-0000-0000-0000-0000000ac201'), '2820 false');

-- 1. Not every line is billed yet: Slab is at 90%.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('accepted before every line is billed', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb01')$s$, 'Accept the work once every line is billed');
RESET ROLE;
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('the final before every line is billed', $s$SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01', gbt.final())$s$, 'finalNotYet', 'The final pay application opens once every line is billed and the work is accepted.');
-- The last of the Slab: $1,800 less $180 held.
SELECT public.gc_trade_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01',
  jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('line', '00000000-0000-0000-0000-0000000ac102', 'toPct', 100)),
    'periodTo', public.app_today()::text, 'signedBy', 'Pat Ridgeway'));
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT public.gc_approve_draw(gbt.draw(3));
SELECT public.gc_pay_draw(gbt.draw(2));
SELECT public.gc_pay_draw(gbt.draw(3));
SELECT gbt.same('every line billed, and what we hold', public.gc_sow_all_billed('00000000-0000-0000-0000-0000000ac201') || ' ' || trim_scale(public.gc_retainage_held('00000000-0000-0000-0000-0000000ac201')), 'true 3000');

-- 2. The punch list holds the acceptance until its item is fixed and checked.
SELECT gbt.refused('accepted with the punch list open', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb01')$s$, 'Their punch list has 1 item to fix or check first');
RESET ROLE;
UPDATE public.gc_punch_items SET fixed_on = public.app_today() - 1 WHERE id = '00000000-0000-0000-0000-0000000ac601';
SET LOCAL ROLE authenticated;
SELECT gbt.refused('accepted with an item fixed, not checked', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb01')$s$, 'Their punch list has 1 item to fix or check first');
RESET ROLE;
UPDATE public.gc_punch_items SET checked_on = public.app_today(), checked_by = '00000000-0000-0000-0000-0000000acd01' WHERE id = '00000000-0000-0000-0000-0000000ac601';
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd02');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account accepts', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb01')$s$, 'A training account cannot accept a trade''s work');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd03');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin accepts', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb01')$s$, 'A digital twin cannot accept a trade''s work');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT gbt.same('accepted today', (public.gc_accept_work('00000000-0000-0000-0000-0000000acb01') - public.app_today())::text, '0');
SELECT gbt.refused('accepted twice', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb01')$s$, 'We accepted their work already');
SELECT gbt.refused('our own work', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000acb02')$s$, 'Their statement of work is not signed yet');
RESET ROLE;

-- 3. The waivers come in for draws 2 and 3. The promise asked for the final pay application too, so it stays open.
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000ace01', gbt.draw(2));
SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000ace01', gbt.draw(3));
RESET ROLE;
SELECT gbt.same('the final pay application is still owed', gbt.promise(), 'open');

-- 4. The final pay application's refusals, both ways in.
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('no period', $s$SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01', gbt.final('{"periodTo": " "}'))$s$, 'badRequest', 'The pay application needs its period.');
SELECT gbt.trade_refused('no one signs it', $s$SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01', gbt.final('{"signedBy": ""}'))$s$, 'nameNeeded', 'Type the name of who signs it.');
SELECT gbt.trade_refused('a trade with no statement of work', $s$SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb03', gbt.final())$s$, 'notFound', 'No statement of work for that trade.');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('no period', $s$SELECT public.gc_final_pay_app_came_in('00000000-0000-0000-0000-0000000acb01', gbt.final('{"periodTo": "someday"}'))$s$, 'Say the day the pay application runs to');
SELECT gbt.refused('no one signed it', $s$SELECT public.gc_final_pay_app_came_in('00000000-0000-0000-0000-0000000acb01', gbt.final('{"signedBy": " "}'))$s$, 'Say who signed it');
SELECT gbt.refused('a job not being built', $s$SELECT public.gc_final_pay_app_came_in('00000000-0000-0000-0000-0000000acb03', gbt.final())$s$, 'Pay applications are for a job we are building');
SELECT gbt.refused('one of ours recording it as someone else', $s$SELECT public.gc_final_pay_app_ask('00000000-0000-0000-0000-0000000ac201', gbt.final(), '00000000-0000-0000-0000-0000000acd04')$s$, 'badRequest');
RESET ROLE;

-- 5. The final pay application from the portal: the $3,000 we hold, the $500 charge never paid back. With no waiver
-- owed, it keeps the promise.
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01', gbt.final());
SELECT gbt.trade_refused('a second final', $s$SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01', gbt.final())$s$, 'finalSent', 'The final pay application went already.');
RESET ROLE;
SELECT gbt.same('the release: the retainage we hold', gbt.draws(),
  E'D1 paid unconditional 15000/1500/13500\nD2 paid unconditional 13200/1320/11880\nD3 paid unconditional 1800/180/1620\nD4 release requested conditional 0/-3000/3000');
SELECT gbt.same('the final pay application keeps the promise', gbt.promise(), 'kept today');
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a final that came by email, twice', $s$SELECT public.gc_final_pay_app_came_in('00000000-0000-0000-0000-0000000acb01', gbt.final())$s$, 'Their final pay application is in already');

-- 6. Its approval waits for the customer to pay us ours, and 10 days.
SELECT gbt.refused('a draw that is not the release', $s$SELECT public.gc_approve_retainage(gbt.draw(3))$s$, 'Only a retainage release is approved here');
SELECT gbt.refused('the customer has not paid us', $s$SELECT public.gc_approve_retainage(gbt.draw(4))$s$, 'The customer has not paid us our retainage yet');
RESET ROLE;
-- Our final pay application to the customer, its bill on the billing job, and $20,000 of the $50,000 paid.
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000ac801', 'Closeout Bed Billing');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-0000000ac901', '00000000-0000-0000-0000-0000000acd01', '00000000-0000-0000-0000-0000000ac801', 'Closeout test A (GC)'),
  ('00000000-0000-0000-0000-0000000ac902', '00000000-0000-0000-0000-0000000acd01', '00000000-0000-0000-0000-0000000ac801', 'Closeout test C (GC)');
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, sequence_order, status) VALUES
  ('00000000-0000-0000-0000-0000000ad001', '00000000-0000-0000-0000-0000000ac901', 50000, 1, 'open'),
  ('00000000-0000-0000-0000-0000000ad002', '00000000-0000-0000-0000-0000000ac902', 50000, 1, 'paid');
INSERT INTO public.gc_owner_pay_apps (id, project_id, number, final, period_to, sent_on, retainage_pct, retainage, work_to_date, due, invoice_id) VALUES
  ('00000000-0000-0000-0000-0000000ad201', '00000000-0000-0000-0000-0000000aca01', 4, true, public.app_today() - 25, public.app_today() - 25, 10, 0, 500000, 50000, '00000000-0000-0000-0000-0000000ad001'),
  ('00000000-0000-0000-0000-0000000ad202', '00000000-0000-0000-0000-0000000aca03', 6, true, public.app_today() - 40, public.app_today() - 40, 10, 0, 500000, 50000, '00000000-0000-0000-0000-0000000ad002');
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, paid_on) VALUES
  ('00000000-0000-0000-0000-0000000ad101', '00000000-0000-0000-0000-0000000ac901', '00000000-0000-0000-0000-0000000ad001', 20000, public.app_today() - 20);
SELECT gbt.same('a bill paid in part is not paid', coalesce(public.gc_owner_retainage_paid_on('00000000-0000-0000-0000-0000000aca01')::text, 'not paid'), 'not paid');
-- The rest comes in 5 days ago: too soon.
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, paid_on) VALUES
  ('00000000-0000-0000-0000-0000000ad102', '00000000-0000-0000-0000-0000000ac901', '00000000-0000-0000-0000-0000000ad001', 30000, public.app_today() - 5);
SELECT gbt.same('paid the day the payments reach the bill', (public.gc_owner_retainage_paid_on('00000000-0000-0000-0000-0000000aca01') - public.app_today())::text, '-5');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('the release before its 10 days', $s$SELECT public.gc_approve_retainage(gbt.draw(4))$s$, 'We pay their retainage from');
RESET ROLE;
UPDATE public.jobs_ledger_payments SET paid_on = public.app_today() - 12 WHERE id = '00000000-0000-0000-0000-0000000ad102';
SELECT gbt.same('the payments reach A''s bill 12 days ago, and C''s has none yet', (SELECT string_agg(x, ' ') FROM (VALUES
  ((public.gc_owner_retainage_paid_on('00000000-0000-0000-0000-0000000aca01') - public.app_today())::text),
  (coalesce((public.gc_owner_retainage_paid_on('00000000-0000-0000-0000-0000000aca03') - public.app_today())::text, 'none'))) v(x)), '-12 none');
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, paid_on) VALUES
  ('00000000-0000-0000-0000-0000000ad103', '00000000-0000-0000-0000-0000000ac902', '00000000-0000-0000-0000-0000000ad002', 20000, public.app_today() - 30),
  ('00000000-0000-0000-0000-0000000ad104', '00000000-0000-0000-0000-0000000ac902', '00000000-0000-0000-0000-0000000ad002', 25000, public.app_today() - 18);
SELECT gbt.same('C''s bill, marked paid at $45,000 of $50,000: paid on its last payment', (public.gc_owner_retainage_paid_on('00000000-0000-0000-0000-0000000aca03') - public.app_today())::text, '-18');
-- B's progress bill, paid in full, opens no trade's retainage: only our final pay application's bill does (Helper 15).
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name) VALUES
  ('00000000-0000-0000-0000-0000000ac903', '00000000-0000-0000-0000-0000000acd01', '00000000-0000-0000-0000-0000000ac801', 'Closeout test B (GC)');
INSERT INTO public.jobs_ledger_invoices (id, job_id, amount, sequence_order, status) VALUES
  ('00000000-0000-0000-0000-0000000ad003', '00000000-0000-0000-0000-0000000ac903', 40000, 1, 'paid');
INSERT INTO public.gc_owner_pay_apps (id, project_id, number, final, period_to, sent_on, retainage_pct, retainage, work_to_date, due, invoice_id) VALUES
  ('00000000-0000-0000-0000-0000000ad203', '00000000-0000-0000-0000-0000000aca02', 1, false, public.app_today() - 30, public.app_today() - 30, 10, 4000, 44000, 40000, '00000000-0000-0000-0000-0000000ad003');
INSERT INTO public.jobs_ledger_payments (id, job_id, invoice_id, amount, paid_on) VALUES
  ('00000000-0000-0000-0000-0000000ad105', '00000000-0000-0000-0000-0000000ac903', '00000000-0000-0000-0000-0000000ad003', 40000, public.app_today() - 20);
SELECT gbt.same('a paid progress bill and no final: not paid', coalesce(public.gc_owner_retainage_paid_on('00000000-0000-0000-0000-0000000aca02')::text, 'not paid'), 'not paid');
SET LOCAL ROLE authenticated;
SELECT gbt.same('the release approved 12 days after the customer paid us', (public.gc_approve_retainage(gbt.draw(4)) - public.app_today())::text, '0');
SELECT gbt.refused('approved twice', $s$SELECT public.gc_approve_retainage(gbt.draw(4))$s$, 'Only a pay application waiting on us is approved');
SELECT public.gc_pay_draw(gbt.draw(4));
RESET ROLE;
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT public.gc_trade_unconditional_waiver('00000000-0000-0000-0000-0000000ace01', gbt.draw(4));
RESET ROLE;
SELECT gbt.same('paid back: nothing held, the final release in', trim_scale(public.gc_retainage_held('00000000-0000-0000-0000-0000000ac201'))::text || ' | '
  || (SELECT string_agg(x, E'\n') FROM unnest(string_to_array(gbt.draws(), E'\n')) x WHERE x LIKE 'D4 %'), '0 | D4 release paid unconditional 0/-3000/3000');

-- 7. Close the job: a dev's while Building is built, once.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd04');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('an estimator closes a job', $s$SELECT public.gc_close_job('00000000-0000-0000-0000-0000000aca01')$s$, 'Closing a job is a dev''s while Building is built');
SELECT gbt.refused('a signed-in caller cannot be the trade', $s$SELECT public.gc_trade_final_pay_app('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000acb01', gbt.final())$s$, 'permission denied');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd02');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account closes a job', $s$SELECT public.gc_close_job('00000000-0000-0000-0000-0000000aca01')$s$, 'A training account cannot close a job');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd03');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin closes a job', $s$SELECT public.gc_close_job('00000000-0000-0000-0000-0000000aca01')$s$, 'A digital twin cannot close a job');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a job still bidding', $s$SELECT public.gc_close_job('00000000-0000-0000-0000-0000000aca02')$s$, 'Only a job we are building is closed');
SELECT gbt.refused('a job that does not exist', $s$SELECT public.gc_close_job('00000000-0000-0000-0000-0000000acaff')$s$, 'No GC project with that id');
SELECT gbt.same('closed today', (public.gc_close_job('00000000-0000-0000-0000-0000000aca01') - public.app_today())::text, '0');
SELECT gbt.refused('closed twice', $s$SELECT public.gc_close_job('00000000-0000-0000-0000-0000000aca01')$s$, 'This job is closed already');
RESET ROLE;
SELECT gbt.same('the job reads closed today', (SELECT stage || ' ' || (closed_on = public.app_today()) FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-0000000aca01'), 'closed true');
SELECT gbt.refused('a closed day on a job not closed', $s$UPDATE public.gc_projects SET closed_on = public.app_today() WHERE project_id = '00000000-0000-0000-0000-0000000aca03'$s$, 'gc_projects_closed_on_when_closed');

-- 8. A change Ridgeway signed on paper: the office records it into a line of their Masonry statement of work.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT public.gc_send_trade_change('00000000-0000-0000-0000-0000000ad301');
SELECT gbt.refused('a change never sent to them', $s$SELECT public.gc_trade_change_signed_in('00000000-0000-0000-0000-0000000ad302')$s$, 'Send the change to the trade first');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd02');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account records a signature', $s$SELECT public.gc_trade_change_signed_in('00000000-0000-0000-0000-0000000ad301')$s$, 'A training account cannot record a signature');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd03');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin records a signature', $s$SELECT public.gc_trade_change_signed_in('00000000-0000-0000-0000-0000000ad301')$s$, 'A digital twin cannot record a signature');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000acd01');
SET LOCAL ROLE authenticated;
SELECT public.gc_trade_change_signed_in('00000000-0000-0000-0000-0000000ad301', ' CO-1 signed.pdf ', 'https://drive.google.com/file/d/co1/view');
SELECT gbt.refused('signed in twice', $s$SELECT public.gc_trade_change_signed_in('00000000-0000-0000-0000-0000000ad301')$s$, 'They signed it already');
RESET ROLE;
SELECT gbt.same('the credit is a line of their statement of work, done at once, recorded by us with its file',
  (SELECT l.position || ' ' || l.label || ' ' || trim_scale(l.amount) FROM public.gc_sow_lines l WHERE l.change_order_id = '00000000-0000-0000-0000-0000000ad301')
    || ' | ' || (SELECT trim_scale(r.pct) || ' ' || (r.recorded_by = '00000000-0000-0000-0000-0000000acd01') FROM public.gc_sow_line_reports r JOIN public.gc_sow_lines l ON l.id = r.sow_line_id WHERE l.change_order_id = '00000000-0000-0000-0000-0000000ad301')
    || ' | ' || (SELECT (t.signed_on = public.app_today()) || ' ' || (t.recorded_by = '00000000-0000-0000-0000-0000000acd01') || ' ' || t.file_name || ' ' || t.drive_url
                 FROM public.gc_change_order_trade_sends t WHERE t.change_order_id = '00000000-0000-0000-0000-0000000ad301'),
  '1 Change order 1: Leave out the lintel -400 | 100 true | true true CO-1 signed.pdf https://drive.google.com/file/d/co1/view');
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('the trade signs one we recorded', $s$SELECT public.gc_trade_sign_change('00000000-0000-0000-0000-0000000ace01', '00000000-0000-0000-0000-0000000ad301')$s$, 'alreadySigned', 'You signed it already.');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
```

**Run here first**, in the same PGlite bed on main's GC chain at 6186bb429, with a stand-in for the Pipeline's
`jobs_ledger_payments`. U6a and U6c each applied twice. `60_draws.sql` passed its 99 and `70_closeout.sql` its 53,
three runs in a row. Fourteen planted bugs each failed it:
- the release less the charges taken;
- a fixed item counted as done;
- no 10 days' wait;
- paid on the first payment;
- a bill paid for less never paid;
- anyone closes a job;
- the final keeping no promise;
- anyone recorded as anyone;
- a second final allowed;
- accepted before every line is billed;
- a progress bill's payment counted as our final's (Helper 15's case);
- a change signed in before it was sent;
- a signed-in credit not reported done;
- no one named as its recorder.

### The migration doc as it will be (U6c)

````markdown
# <stamp>_gc_trade_closeout.sql (2026-10-09, v2.NNNN)

GC mode, the real build, the Building lane's U6c: closeout (`to-dos/gc-mode/mockups/building-u6.md` on branch `spike/gc-mode`, amendments 2 and 3). Four columns, a check, and ten functions on U6a's draws (`<U6a stamp>_gc_trade_draws`). The punch list is U1's (`20261008030000`). Our bills to the customer are Owner Billing's (`20261008010000`, `20261009200000`).

- **`gc_projects.closed_on`**: the day we closed the job (`GcProject.closedOn`), only on a closed one (`gc_projects_closed_on_when_closed`).
- **The helpers**, read only:
  - `gc_retainage_held(sow)`: what we hold (`retainageHeldNow`);
  - `gc_sow_all_billed(sow)`: every line billed (`workAllBilled`);
  - `gc_owner_retainage_paid_on(project)`: the day the customer paid our final pay application's bill, by `billMoney`'s rule in `src/lib/gc/ownerBillingRows.ts`. That is the day the payments reach the bill, or the last payment's day once it is marked paid for less.
- **`gc_accept_work(p_package_id uuid)`**: once every line is billed and no punch item on the trade lacks its check. Not twice.
- **`gc_final_pay_app_ask(p_sow_id uuid, p jsonb, p_recorded_by uuid)`**: the final pay application's rules, shared.
  - Its money is the retainage held: gross none, retainage the release taken back, net the release.
  - It comes once every line is billed and the work is accepted, once, with no draw waiting and retainage held.
  - With no waiver owed, it keeps the closeout promise.
  - A signed-in caller records it only as themselves.
  - It raises keys: `finalSent`, `drawWaiting`, `finalNotYet`, `nothingToBill`, `badRequest`, `nameNeeded`.
- **`gc_trade_final_pay_app(p_company_id uuid, p_package_id uuid, p_app jsonb)`**: the trade's, the service role's only, after `notFound`, `notOnTrade`, `sowNotSigned` and `jobNotBuilding`.
- **`gc_final_pay_app_came_in(p_package_id uuid, p jsonb)`**: the office's, in its own words.
- **`gc_approve_retainage(p_draw_id uuid)`**: the release, 10 days after the customer paid us ours.
- **`gc_trade_change_signed_in(p_change_order_id uuid, p_file_name text DEFAULT NULL, p_drive_url text DEFAULT NULL)`**: a change the trade signed on paper or by email, the office's twin of `gc_trade_sign_change`. It makes the same line, reports a credit done, and keeps who recorded it and the file in `gc_change_order_trade_sends`' new `recorded_by`, `file_name` and `drive_url`. Not before the change was sent, nor twice.
- **`gc_close_job(p_project_id uuid)`**: the stage `closed` and `closed_on` today, for a job we are building. A dev's while Building is built.

`SECURITY INVOKER`, every one. The office's presses and the helpers go to `authenticated`, and the trade's to the service role only. `finalSent` and `finalNotYet` wait in WAITING as `'P5'`.

Apply order: after U6a. `gc_projects` gains a nullable column and a check that every row passes. It locks the table briefly behind `lock_timeout 3s`. The rest is `CREATE OR REPLACE`. It is idempotent.

**Before the push**, the SQL bed plays `70_closeout.sql` beside the other Building scenarios. It walks a trade from its last draw through acceptance, the waivers, its final pay application, the customer's payment and 10 days, the release paid and its final release, to the job closed. It checks each refusal and the customer's paid day both ways. It ends `gc_building PASSED`.

## Verify after the push

1. **The columns, the check and the ten functions**, with invoker's rights and the right callers. Use the same query as U6a's step 1 on these names, and `SELECT conname FROM pg_constraint WHERE conname = 'gc_projects_closed_on_when_closed'`, and `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND (table_name, column_name) IN (('gc_projects', 'closed_on'), ('gc_change_order_trade_sends', 'recorded_by'), ('gc_change_order_trade_sends', 'file_name'), ('gc_change_order_trade_sends', 'drive_url'))`, four rows.
2. **The customer's paid day, read only, as a dev**: `gc_owner_retainage_paid_on` on a project with a final pay application, if one exists on prod. It should equal Bill the customer's paid day.
3. **A training account's call is refused in words**: `gc_close_job` gives *A training account cannot close a job.* (`42501`).
4. **The trade's press is the service role's only**: as a dev, `gc_trade_final_pay_app` gives *permission denied*.

## Rollback

```sql
DROP FUNCTION IF EXISTS public.gc_close_job(uuid);
DROP FUNCTION IF EXISTS public.gc_trade_change_signed_in(uuid, text, text);
DROP FUNCTION IF EXISTS public.gc_approve_retainage(uuid);
DROP FUNCTION IF EXISTS public.gc_final_pay_app_came_in(uuid, jsonb);
DROP FUNCTION IF EXISTS public.gc_trade_final_pay_app(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.gc_final_pay_app_ask(uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS public.gc_accept_work(uuid);
DROP FUNCTION IF EXISTS public.gc_owner_retainage_paid_on(uuid);
DROP FUNCTION IF EXISTS public.gc_sow_all_billed(uuid);
DROP FUNCTION IF EXISTS public.gc_retainage_held(uuid);
ALTER TABLE public.gc_projects DROP CONSTRAINT IF EXISTS gc_projects_closed_on_when_closed;
ALTER TABLE public.gc_projects DROP COLUMN IF EXISTS closed_on;
ALTER TABLE public.gc_change_order_trade_sends DROP COLUMN IF EXISTS recorded_by, DROP COLUMN IF EXISTS file_name, DROP COLUMN IF EXISTS drive_url;
```

## Status

Written for the Building lane's U6c; not applied. The lead pushes it after the merge and records here what steps 1 to 4 said.
````

## U6d: the closeout window

U6d ports `GcCloseout.tsx` (301 lines) as the **Closeout** window, at `?closeout=<projectId>`, behind the same two gates
as Draws:
- each trade's closeout steps (`tradeCloseout`);
- **Accept the work**, held by the punch list in its words (`punchWords`);
- the final pay application to read, the release's **Approve** held until its day, and **Mark paid**;
- **Close the job** once `jobCloseout` is ready, with what is left in words until then.

The mapper reads `gc_projects.closed_on` into `GcProject.closedOn`. A closed job leaves Building for its own section on
the board.

## Drift from `BUILDING_REAL_BUILD.md`

- **Four tables, not five** (call 4): a pay application sent back is a `gc_draws` status, not a jsonb copy.
- **The money is the SQL's** (call 3), held to the kernels by the scenario.
- **The office records what came by email or on paper** (call 2): a pay application, the final one, and a waiver.
- **No `draw_ask` and no `warranty`** (call 5).
- **The kernel's `drawLinesOf` keeps a credit's line**, and U6c's release is the retainage held (found above).
- **A report's reporter**: the plan's `reported_by_company_id` or `reported_by` is `company_id`, whose report it is,
  and `recorded_by`, who of ours typed it (null from the portal), as the RFIs' recorder is.
- **No `part_id` on a report yet**: a part of a split line is P5d's with the schedule's PR 16, and U6a refuses a split
  line's whole report.
- **A pay application's address and license stay on the draw**: the prototype also wrote them onto the company. The
  next form starts from the newest draw's words, so the Board's company record is not written from Building.
- **The papers that hold an approval are the window's** (`partnerBlockers`), as the prototype's reducer trusts its
  screen. The SQL would need B6-b's papers on main to check them.

## The check (U6b, on "GC test project, delete me", as a dev)

It waits for a signed statement of work there (call 6, P2c).
1. Record a pay application that came by email, with stored materials and its Drive link.
2. Send it back with what to fix, record it again, and approve it for less.
3. Take a back-charge off it, mark it paid, and record the unconditional waiver.
4. See Owner Billing's draft bill read the trade's line.
5. Any email to the test trade waits for Grace's own yes in Helper 18's chat.

## When it is cut

- **U6a**: from `origin/main` once this plan merges; claim the version and the stamp; swap them in; add the kernel fix
  and its test, the PRESSES line, the sql-beds path, WAITING's keys and `doors.ts`; run the bed; arm. The lead pushes
  it on merge.
- **U6b**: on U6a's types.
- **U6c**: once its amendment is approved. **U6d** on U6c's types.

## Docs each PR touches

- **U6a**: `docs/migrations/<stamp>_gc_trade_draws.md`, the release note and fragment.
- **U6b**: `PROJECT_DOCUMENTATION.md` (the Draws window), `GLOSSARY.md` (*draw*, *pay application*, *stored
  materials*), `ACCESS_CONTROL.md` (the window's two gates), the guide *pay a trade's draw*.
- **U6c**: its migration doc. **U6d**: `GLOSSARY.md` (*retainage release*, *closeout*), the closeout window's paragraph
  and guide.

## Seams

- **The Board** (B6): `gc_sow_lines`' check widened for a credit, `gc_sows.accepted_on` reused by U6c, and B6-b-ii's
  papers, which `partnerBlockers` reads for Approve.
- **The Portal** (Helper 13): P5c's kinds and the portal's Pay block; the new keys in WAITING, with `alreadySigned`
  shared with P2c-i; the words of the `paid`, `less` and `change` emails.
- **Owner Billing** (Helper 15): their readers start reading real draws through `withDraws`. Their final pay
  application's paid day opens a trade's retainage (U6c). U6c's release fix touches `finalPayApplication`'s line 7.
- **The schedule** (Helper 11): a trade's report sets its bar's real days, which the guard lets pass as records, and
  `report_part` is PR 16's with P5d.
- **Helper 14**: U3b's punch presses, which closeout's Accept the work reads, and the Draws button after RFIs on the
  card.

## Is this the best we can do?

- **The money in one place.** The SQL and the kernel each work a draw out, held equal by a scenario. One rule would be
  better: the kernel's file loaded into the database (plv8) is not on Supabase, and the SQL read by the client would
  need a round trip per keystroke on the pay application. Two copies with a parity test is the house's way already
  (`gc_leveled_total`, `awardSql.test.ts`).
- **The papers in the SQL.** Holding Approve on the papers in the SQL would make the window's rule the database's.
  It waits for B6-b's papers on main; then it is a small amendment.

## Status

Plan 2026-10-09 by Helper 18. U6a's SQL ran green in PGlite on main at 6186bb429. Amendment 1 the same day: the line-id comment and `seq` (above). U6c's SQL follows in an amendment.
