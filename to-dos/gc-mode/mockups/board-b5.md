---
name: "B5: compare, carry and our number, with our number's money behind its own door"
rows: BOARD_REAL_BUILD.md, B5 (The PRs, in order, row 6); PLAN_2026-10-07.md, the Board's row; door 1 (mockups/door-1-new-project.md), the team policy this narrows; PORTAL_REAL_BUILD.md, P5e (the bid tab in the portal)
branch: the plan on spike/board-b5-plan (from origin/spike/gc-mode at 29068472b); the PRs from origin/main when the lead says go
status: plan 2026-10-08 by Helper 2 at the lead's ask. Nothing cut, nothing claimed. Six calls for the lead below, two of them the owner's.
---

# B5: compare, carry and our number

## What it is

B5 turns the quotes the trades send into **our number**, the price we give the customer:

1. **Compare quotes** on a trade: each quote line by line, plugs for lines a quote leaves out, the exclusions table with who covers each, and alternates.
2. **Carry** one quote, or our budget, as the trade's number.
3. **Our number**: the trades we carry plus general conditions, contingency and fee. Then **We sent our bid**, **We won this**, **We lost this** and **Bring it back**.
4. **Bid tabs**: once our bid is in, each company that quoted sees where it stood, with names hidden unless the office shares them.

It is the first screen with money of ours on it. Our general conditions, contingency and fee say what we add on top of the trades. So the first thing B5 does is give that money its own door, and prove nobody else can read it.

## 1. The money first: who may read our number

### Today's gap

The three inputs sit on `gc_projects` (`general_conditions`, `contingency_pct`, `fee_pct`, from New project's first migration, `20261006233000`). Since door 1 (`20261008003000`), `gc_projects` has one policy, `gc_projects_team`, open to `gc_office_team()`: dev, the leaders, the assistants, the controller and estimators. So **an estimator can read our markup today**, the moment anyone types it.

Nothing has leaked yet. Prod has one GC project, and its three values are 0 (read 2026-10-08, `count(*) filter (where … <> 0)` = 0). `gc_create_project` does not write them, and no screen does. B5 moves them behind their own door **before** the Our number tab writes the first real value. That ordering is the point of the plan.

### The audience, named once

```sql
-- Who may read and write our number: our general conditions, contingency and fee.
CREATE OR REPLACE FUNCTION public.gc_money_team()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'controller')
  );
$$;
COMMENT ON FUNCTION public.gc_money_team() IS
  'GC mode (B5): who reads and writes our number (general conditions, contingency, fee): dev, the leaders (master_technician) and the controller. Change the audience here, never in a policy. The client''s copy is GC_MONEY_TEAM in src/lib/gc/access.ts.';
REVOKE EXECUTE ON FUNCTION public.gc_money_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_money_team() TO authenticated, service_role;
```

It is written out rather than composed from `is_master_or_dev() OR is_controller()`, so the one place that says who sees money reads plainly, and a change to either helper cannot widen it by accident. Owner Billing's door can use the same function when it opens its tables "to the owner and the controller" (call M).

### The table

```sql
CREATE TABLE IF NOT EXISTS public.gc_project_money (
  project_id uuid PRIMARY KEY REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  general_conditions numeric NOT NULL DEFAULT 0
    CONSTRAINT gc_project_money_gc_not_negative CHECK (general_conditions >= 0),
  contingency_pct numeric NOT NULL DEFAULT 0
    CONSTRAINT gc_project_money_contingency_range CHECK (contingency_pct >= 0 AND contingency_pct <= 100),
  fee_pct numeric NOT NULL DEFAULT 0
    CONSTRAINT gc_project_money_fee_range CHECK (fee_pct >= 0 AND fee_pct <= 100),
  updated_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gc_project_money ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_project_money_team ON public.gc_project_money;
CREATE POLICY gc_project_money_team ON public.gc_project_money FOR ALL TO authenticated
  USING ((SELECT public.gc_money_team())) WITH CHECK ((SELECT public.gc_money_team()));
REVOKE ALL ON public.gc_project_money FROM anon;
-- … the backfill (section 2), then:
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
```

- **One row per project**, keyed by the project. It is written by a plain upsert under the policy, so no function is needed.
- **No row** reads as zeros for the kernels, the same as today's defaults.
- **The audience from day one** is the money team, not `is_dev()`. While B5 is built, only the screen is dev only. The table's audience is right from its first row, so the door later changes a screen, never a policy.
- `updated_by` and `updated_at` say who last changed our number. There is no history table. Call H asks whether the owner wants one.

### The proof, before anything else ships

The plan's check for B5 starts here. Nothing else in B5 merges until the check passes on prod.

**Before the push, on a local Postgres (PGlite)**, with B1's chain, door 1 and this migration, a user of each role reads and writes `gc_project_money`:

| Who | Reads a row | Writes a row |
|---|---|---|
| dev, master_technician, controller | yes | yes |
| assistant, estimator | **no rows** | refused |
| superintendent, primary, subcontractor, helpers | **no rows** | refused |
| a training-mode controller (`read_only`) | yes | refused (the read-only blocks) |
| a training-mode estimator | **no rows** | refused |
| a digital twin | **no rows** | refused (the twin fence) |
| `anon` | permission denied | permission denied |

**After the push, on prod, read only**, two ways:

- dev-mcp's `view_as` reads `gc_project_money` as the assistant's, the estimator's and the superintendent's sample accounts, and gets zero rows. As the controller's it gets the row.
- A rolled-back transaction per role (`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', …, true); SELECT … ; ROLLBACK;`) gives the same result, and the migration doc prints it.

**In CI**, the client keeps its copy of the audience beside door 1's: `GC_MONEY_TEAM` and `canSeeGcMoney(role)` in `src/lib/gc/access.ts`. `access.test.ts` reads the migration file and fails when the roles in `gc_money_team()` and the client's list differ, so the two copies cannot drift.

## 2. Expand, then contract: two migrations

**Two migrations on two days, recommended.** The expand step goes in B5's migration (day 4), and the contract step in B6-a's (day 5).

- **The expand step (B5)** is additive.
  - It creates `gc_project_money` and copies each project's three values into it:

    ```sql
    INSERT INTO public.gc_project_money (project_id, general_conditions, contingency_pct, fee_pct)
    SELECT project_id, general_conditions, contingency_pct, fee_pct FROM public.gc_projects
    ON CONFLICT (project_id) DO NOTHING;
    ```

  - From B5-c on, the client reads and writes only the new table. The old columns stay, unwritten.
- **The contract step (B6-a)** drops the three columns from `gc_projects`, and the types are regenerated.
  - It runs after B5-c's client has been live a day, and a grep of `src/` and `supabase/functions/` finds no reader of the three columns.
  - Its doc reads every project's three values from both places the day before, and they must match.

**Why not one migration with the backfill and the drop together:**

1. **The deployed client.** `loadGcProjects` reads `gc_projects` with `select('*')` and maps the three columns (`projectRows.ts`). The new client reads `gc_project_money` instead.
   - With one migration, the merge deploys the new client before the lead's push makes the table. Every dev's board fails to load until the push.
   - In the other order, the old client and every cached PWA would lose the columns. `num()` reads a missing column as 0, so they would quietly show markup as 0.
   - Additive first means no window where any client reads something that is not there.
2. **The generated types.** Dropping the columns removes them from `database.ts`. That regeneration has to come after the client stops naming them, so it belongs in its own PR.
3. **The lock.** `ALTER TABLE gc_projects DROP COLUMN` takes the strongest lock on the table every office user reads. On its own day it waits for a quiet moment under `lock_timeout = '3s'` without holding up B5's other tables.
4. **One migration per lane per day**, the lead's rule. Day 4's migration is B5's, and the drop rides B6-a's on day 5.

Between the two steps nothing can leak. The old columns stay 0, because nothing writes them: `gc_create_project` never did, and B5-c writes the new table. A one-migration version would be safe for the data, since prod's values are 0. It loses only on the client's timing above.

## 3. What else B5's migration adds

B5's one migration, `<stamp>_gc_our_number.sql`, carries section 1 and these, all additive:

- **Carry**, on `gc_trade_packages`:
  - `carried_invite_id uuid`, with a composite FK so it can only name an ask on this trade (`(carried_invite_id, id)` → `gc_invites(id, package_id)`, beside a new `UNIQUE (id, package_id)` on `gc_invites`), with `ON DELETE SET NULL (carried_invite_id)`. That is Postgres 15's column list, so a deleted ask clears the carry and never the trade's own `id`;
  - `carry_budget boolean NOT NULL DEFAULT false`;
  - a check that they are not both set.
  - The kernels' `pkg.carried` reads `carried_invite_id ?? (carry_budget ? 'plug' : null)`, and `'self'` for our own trade as today.
  - The office team writes it with a plain update, since which quote we carry is not markup (call C).
- **The bid tab**:
  - `gc_bid_tabs(package_id uuid PRIMARY KEY REFERENCES gc_trade_packages ON DELETE CASCADE, shared_on date NOT NULL DEFAULT public.app_today(), show_names boolean NOT NULL DEFAULT false, shared_by uuid DEFAULT auth.uid())`, for the office team;
  - `gc_bid_tab_views(package_id, company_id, seen_on date DEFAULT public.app_today(), PRIMARY KEY (package_id, company_id))`. The Portal's `gc_trade_see_bid_tab` writes it (P5e), and the office team reads it.
  - Every date default is `public.app_today()`, never `CURRENT_DATE` (B1's lesson, #4951).
- **The project's outcome**: nothing new. `our_bid_sent_on` (B1), `stage`, `lost_on`, `lost_why`, `won_by` and `lost_note` (New project) are already on `gc_projects`, written by the office team. **We sent our bid**, **We won this** and **We lost this** are plain updates. Each stamps its day with `public.app_today()` through a one-line function: `gc_mark_bid_sent`, `gc_mark_won` and `gc_mark_lost`, so the day is the company's (see call D).

## 4. Compare and carry on real quotes (B5-b)

Ported from the spike's `LevelPanel` (`GcOfficeTabs.tsx`) onto B2-i's kernels, which are already on main: `compareBids`, `packageCoverage`, `uncostedLines`, `leveledTotal`, `lowLeveled`, `takenAlternatesTotal`, `carriedAmount`, `quoteRanOut` and `bidIsStale`. It opens from a trade on the project card, and from the price card's trade line.

- **The grid**: one column per quote, one row per scope line. A cell reads *in*, *left out* or *not clear*, and a left-out line takes a **plug**, our dollar for it. Plugs write `gc_invites.plugs` (B1). They are the office's numbers, and the portal never selects them.
- **The exclusions table** (`GcExclusionRows.tsx`): each exclusion a quote names, with **who covers it**. That writes `gc_invites.exclusion_covers` (B1).
- **Alternates**: **Take** an alternate and it counts in that quote's leveled total. That writes `gc_invites.taken_alternates` (B1).
- **The sentences** over the grid, from `compareBids`:
  - *Lowest, all in* names the leveled low.
  - A stale quote (on an older set of plans) and a quote past its good-for days are flagged.
  - *not clear* lines are counted.
- **Carry this one** on a quote, or **Carry our budget**. That writes `carried_invite_id` / `carry_budget`. The price card and the board row move at once.
- The trade's card shows the carried number with its *+ ?* (section 5).

## 5. The price card's "+ ?" reading (B5-b)

A carried quote can leave lines with no cost: not in its price and no plug. Until each is costed, our number is a floor, not the price.

- **The board row and the price card**: the price reads **$412,600 + ?** when `proposalUncosted(project)` is not empty.
  - The *+ ?* is `PlusUnknown` (on main in `gcUi.tsx`). Its words are `proposalUncostedWords(project)`, for example *In Roofing, 1 line has no cost yet: roof curbs.*
  - The hover and the screen reader add *This number counts it as $0 until you set a cost in Compare quotes.*
- **The card's trade lines**: each carried trade with an uncosted line reads **Roofing $61,000 + ?**, and *Set a cost* opens Compare quotes at that line.
- **Holes stay as B3-a draws them.** A trade with no number at all reads *so far, with 2 holes*. *+ ?* is the other gap: a number we have that is missing a piece. A row can have both: **$412,600 + ? so far, with 2 holes**.
- **Who sees which price.** The board and the card show the price with our markup only to the money team. Anyone else sees the trades alone.
  - The label reads **Trades so far** instead of **Price so far**, and the card leaves out its general conditions, contingency and fee lines. *About $X once every trade is in* counts trades only.
  - The mapper (`boardProjectFromView`, the one project mapper) gets its three values from `gc_project_money`. For someone else no row comes back, so they read 0. `BoardRows.moneyShown` (false when the read returned nothing for a non-money role) tells the screens which label to draw.
  - The mapper's signature does not change. Its `rows` argument gains `money`. I'll tell the lead before that PR, per the mapper rule.

## 6. The Our number tab (B5-c)

Ported from the spike's `GcNumberTab`, on the project card, **for the money team only** (`canSeeGcMoney`), and dev only while built.

- **The strip**:
  - **Trades** $X + ?;
  - **General conditions** $Y;
  - **Contingency 3%** $Z;
  - **Fee 8%** $W;
  - **Price to Oak Street Partners** $P + ?, red while a trade has no number and green once every line has a cost.
  - All from `proposalTotals` (on main).
- **The holes**: one red chip per trade with no number, and an amber chip per trade on our budget (*our budget, no quote*).
- **The three inputs**: general conditions in dollars, contingency in percent and fee in percent. Each saves on blur once it holds a whole number, the way the app's finished-date boxes save. That is an upsert of `gc_project_money`, and the strip moves at once.
- **The trades table**: Trade · Where the number comes from (the quote we carry, our budget, our own bid, *no number*) · Our budget · Carried, with its *+ ?*.
- **The outcome buttons**:
  - **We sent our bid** (`gc_mark_bid_sent`, then a chip *our bid went in Oct 8*), which opens the bid tabs;
  - **We won this. Start buyout** (`gc_mark_won`: stage → `buyout`);
  - **We lost this**, a short form: why from the loss reasons, who won, a note (`gc_mark_lost`), then **Bring it back** (`gc_mark_lost` with nulls).
  - These buttons write `gc_projects` (the office team). Only the tab they sit on is money-gated, and call D asks whether they should show elsewhere for the rest of the office.
- **Weeks to build** and **For the proposal** (the schedule lane's rough weeks) wait for the schedule's kernels on main. The tab leaves the line out until then.
- **Signed for** (Owner Billing's `priceToOwner`) waits for O3. The tab leaves it out until then.

## 7. Bid tabs (B5-d)

Ported from the spike's `GcBidTabs.tsx` (`GcBidTabsTab`, `TabCard`, `BidTabTable`) onto `bidTabRows`, `bidTabsOpen`, `packageHasTab` and `bidTabResult` (on main).

- A trade with two quotes or more has a tab once our bid is in (`bidTabsOpen`). It shows each quote's rank and how far over the low it was, with companies as *Company A, B…* unless **Show names** is ticked.
- **Share the tab** writes `gc_bid_tabs`. Each company that quoted then sees its line in its portal (P5e, Helper 3), and `gc_bid_tab_views` says who opened it (*seen by 2 of 3*).
- The portal's words come from `bidTabResult`. A lost bid never shows the price or who won (the owner, 2026-10-03).
- **The seam with the Portal**: P5e reads `gc_bid_tabs` and writes `gc_bid_tab_views` through `gc_trade_see_bid_tab`. B5's migration makes both tables, so P5e needs no migration of its own. Helper 3 to confirm the names.

## The PRs, in order

| PR | What | Migration | Waits on |
|---|---|---|---|
| **B5-a** | `gc_money_team()`, `gc_project_money` with its backfill, carry's columns, `gc_bid_tabs`, `gc_bid_tab_views`, `gc_mark_bid_sent`, `gc_mark_won`, `gc_mark_lost`; the role-matrix proof in the doc; `canSeeGcMoney` and its drift test | **yes**, day 4 | the lead's go |
| types | regenerated after the push (Helper 7) | | B5-a pushed |
| **B5-b** | Compare quotes and Carry on a trade; the *+ ?* on the board row, the price card and the trade lines; the *Trades so far* reading for non-money roles | | types |
| **B5-c** | The Our number tab; the mapper reads `gc_project_money` (told to the lead first) | | B5-b |
| **B5-d** | Bid tabs: share, show names, seen by | | B5-c (bidTabsOpen needs *We sent our bid*) |
| **B6-a** | among its own work, the contract step: drop the three columns from `gc_projects`, regenerate types | **yes**, day 5 | B5-c live a day; the doc's two-place read |

Each PR adds its guide:
- B5-b: *compare quotes and carry one*;
- B5-c: *set our number and send our bid*;
- B5-d: *share a bid tab with the trades*.

Each also gets its release note and fragment, the docs it touches, and its live walk on the kept test rows. The test company already has an ask on Concrete; B5-b's walk needs a quote on it, which comes through P2's portal or a test quote the lead OKs.

## Calls for the lead

- **M. The money audience.** Dev, the leaders and the controller, not the assistants. *My pick:* as written. Owner Billing's door uses the same `gc_money_team()`. **The owner's call**, since it decides who sees our markup.
- **H. A history of our number.** Today only who changed it last and when. *My pick:* no table now. Add `gc_project_money_moves` if the owner wants to see what our fee was before a change. **The owner's call.**
- **C. Carry and plugs stay with the office team.** Estimators level quotes and carry one. Only our markup is gated. *My pick:* yes.
- **D. The outcome buttons for the rest of the office.** We sent our bid, We won and We lost sit on the money-gated tab. An assistant cannot press *We sent our bid*. *My pick:* also draw the three on the project card's head for the office team, without any money. Say which.
- **S. Two migrations**, expand in B5-a and contract in B6-a, as section 2 argues. *My pick:* two.
- **W. The non-money price.** *Trades so far* for everyone else, or no price at all on their board. *My pick:* *Trades so far*. Estimators carry quotes and should see what the trades add up to.

## Is this the best we can do?

- **A separate table is the right door for three numbers.**
  - Row security cannot hide columns.
  - Column grants on `gc_projects` would break every `select('*')` the app makes, for every role.
  - A view or a SECURITY DEFINER read would be a second road to keep in step.
  - One small table behind one function, with a test that the function and the client agree, is the least that is provably shut.
- **The proof is the plan's first check, not its last.**
  - The role matrix runs on PGlite before the push and on prod after it.
  - The drift test keeps the client's list honest in CI.
  - If B5 ever shows an estimator a markup, one of those three fails first.
- **What it does not close.** Our price reaches the customer by design (the proposal, then Owner Billing's contract lines). Anyone who reads the owner contract can work backwards to our markup. That is Owner Billing's door to keep (O-lane), and call M lets both doors use one audience.
- **What I would still change.**
  - If the owner wants **contingency kept from the controller too**, the function becomes two, for markup and for contingency, with the same proof. It is easy to split later, since every policy calls the function.
  - **Server-side totals**, an RPC that returns the price without its parts for the office, would let assistants see *Price so far* without the markup. It is not worth it now. Call W's *Trades so far* is honest and needs nothing new.
- **The expand and contract cost one extra day**, and in return no client ever reads a missing table or a missing column. The kept test rows let each PR be walked live the day it lands.

## Status

Plan written 2026-10-08 by Helper 2 at the lead's ask, on `spike/board-b5-plan`. Facts read that day:
- prod's `gc_projects` (1 project, money all 0);
- `gc_projects_team` (door 1);
- the helpers that exist (`is_controller`, `is_master_or_dev`, `is_office_staff`, `is_estimator`);
- `loadGcProjects`'s `select('*')`, and `num()` reading a missing column as 0.

Nothing cut or claimed. It waits for the lead's word and the two owner's calls (M, H).
