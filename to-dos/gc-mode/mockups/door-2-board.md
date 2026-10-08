---
name: "Door 2: the Project Board, Trade partners, Follow up and the Ask window open to the office and estimators"
rows: PLAN_2026-10-07.md, Helper 6's row (door 2 after B3); BOARD_REAL_BUILD.md decision 8 (who sees the board) and call 5 (who may vet); door-1-new-project.md, the pattern
branch: the plan on spike/door-2-plan (from origin/spike/gc-mode at 04aedcebb); the PR from origin/main once B3-c (#4952), B5-b (#4967), B5-c and B5-d are on main, its own migration
status: plan 2026-10-08 by Helper 6 at the lead's ask, with Helper 2's answers the same day (the money gate is B5-c's; the bid tabs open with the board; the outcome strip opens to the team). Nothing cut or claimed. Three calls for the lead, one of them the owner's (call A).
---

# Door 2: the Board opens to the office and estimators

## What it is

One PR from `main` that gives the office and estimators what a dev sees on `/gc` today above the
project cards. The audience is `gc_office_team()`, the same as door 1.

**What opens:**

- **The Project Board** (B3-a): the stage strip, the sections, each project's row with its days left
  and its price line.
- **Trade partners** (B3-b): the bench by trade, **Add a company**, and **New to us** with Approve,
  Approve up to and Decline.
- **Follow up** (B4-b): the pill with its count, and each ask's story.
- **The Ask window** (B4-a-ii): from a trade's asks row on a project card, and from Trade partners.
- **The company window's About** (B3-c, #4952, queued).
- **The bid outcome strip** (B5): *We sent our bid*, *We won this*, *We lost this*, for the whole
  office team (B5's call D).
- **The bid tabs** (`gc_bid_tabs`, `gc_bid_tab_views`): B5-a kept them dev only "until the Board's
  door". B5-d's board loader reads both, so they open with the board (Helper 2, 2026-10-08).

**What stays dev only, each behind its own lane's door:**

| What | Why | Its door |
|---|---|---|
| **Trade portals**, the pill and the link control (`gc_trade_portal_links`, `gc_trade_messages`) | Nothing goes to a trade before the trade wave | Helper 3 says when the trade wave is ready |
| **Our number**, compare and carry (`gc_project_money`) | Money roles only, by its own policy. On the client, B5-c's `canSeeGcMoney` | `gc_money_team()`, already there |
| **The change-order window** | Owner Billing's | Owner Billing's door |
| **The Schedule tab** | The schedule's | Schedule PR 10 (Helper 1) |

Award is B6, so the owner's call on who may award (W) does not hold this door.

**The pieces:**

- **One migration**, `<stamp>_gc_door_2_board_team.sql`: B1's eight tables and B5-a's two bid-tab
  tables swap their `_dev` policy for `_team` on `gc_office_team()`. Nothing else changes in the
  database (call A may add one guard).
- **The page**:
  - the dev section's gate becomes `canOpenGcProjects`, except the **Trade portals** pill and view;
  - each trade's asks row on a project card opens the same way, and so does the outcome strip;
  - our number keeps `canSeeGcMoney`;
  - the section's **Devs only** chip goes.
- **The money on the board** stays with the money team. B5-c's `canSeeGcMoney` and
  `BoardRows.moneyShown` hide it, so door 2 lands after B5-c.
- **Docs in the same PR:**
  - `ACCESS_CONTROL.md`, `APP_DIRECTORY.md` and `PROJECT_DOCUMENTATION.md` §20;
  - the six Board guides' roles lines and their "Only a dev" sentences;
  - the migration doc, a release note and its fragment.
- **No edge function changes, and no types.** Every name already exists.

## What the lead asked

### Do the functions need their own role check?

No. All six are `SECURITY INVOKER` over B1's tables, so the swap is their gate:

- `gc_add_company`, `gc_vet_company`, `gc_invite_companies`, `gc_office_decline`,
  `gc_record_promise` and `gc_keep_promise` (`20261008020000`; `gc_vet_company`, `gc_keep_promise`
  and `gc_office_decline` were redefined in `20261008120000`, still invoker);
- none reads `is_dev()` in its body;
- each writes only B1's tables or reads door 1's (`gc_trade_packages`).

**`gc_keep_promises`** (and `gc_record_promise`) is granted to `service_role` too, so the Portal's
functions can mark a promise kept when a trade does the thing. It needs no check of its own:

- **Called by a person:** it runs as that person. The swap's policy decides, a training account is
  refused by the read-only statement trigger, and a twin by the fence.
- **Called by the service role:** it skips row security, as every service-role write does. That
  path is reached only from the Portal lane's functions, which check the trade's link first (P1 and
  P2). Whether that company may touch that promise is the portal's guard, not this door's.
- **What would change it:** if a later lane ever exposes it to a role that is neither the office
  nor the service role, it should then get its own check.

### Which tables

B1's eight, from `20261008020000_gc_company_record.sql`:

- `gc_companies`, `gc_company_people`, `gc_company_vetting_forms`;
- `gc_invites`, `gc_quotes`;
- `gc_company_contacts`, `gc_trade_promises`, `gc_trade_promise_moves`.

`anon` already has no grant on them (B1). B1's `REVOKE UPDATE, DELETE, TRUNCATE` on the append-only
three (`gc_company_contacts`, `gc_quotes`, `gc_trade_promise_moves`) stays. Privileges hold that, so
a `FOR ALL` policy cannot open it.

**And B5-a's two**: `gc_bid_tabs` and `gc_bid_tab_views`, dev only "until the Board's door". A
bid tab holds which trade's tab was shared and who opened it, with no number of ours. B5-d's loader
reads both for the board. Left dev only, they read no rows for the office (no error), so every tab would read *not shared
yet*.

**Not swapped:**

- `gc_trade_portal_links`, `gc_trade_messages` (P1);
- `gc_project_money`, which keeps `gc_money_team()`;
- the Building and Owner Billing tables, which have their own doors.

### What the screens read

From the source, the screens door 2 opens read:

- B1's tables;
- door 1's tables;
- `gc_trade_portal_links`, only from `tradePortalLinksIo.ts`, behind the Trade portals pill that
  stays dev;
- the Owner Billing tables, from the board's loader. For the office these read no rows, so the board
  loads with nothing owed. It does not error.

Nothing outside `src/lib/gc`, `src/components/gc` and `GcProjects.tsx` reads a Board table. The dev
gates are all in `GcProjects.tsx`, plus one in the company window (#4952).

## Three calls for the lead

**A. Who may approve a company new to us (the Board plan's call 5, the owner's).**

- *My default:* the whole office team, as the prototype and the plan's default have it.
- *The other way:* keep **Approve**, **Approve up to** and **Decline** to an estimator, a leader or a
  dev, like award. Under a team policy a function check is not enough, since an assistant could
  update `vetting_status` straight through the table. So it takes a column guard on
  `gc_companies`, in the same migration:

  ```sql
  CREATE OR REPLACE FUNCTION public.gc_vet_team() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT public.is_dev() OR public.is_estimator() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master_technician');
  $$;
  CREATE OR REPLACE FUNCTION public.gc_companies_vetting_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  BEGIN
    IF auth.uid() IS NOT NULL AND NOT public.gc_vet_team() AND (
      NEW.vetting_status IS DISTINCT FROM OLD.vetting_status OR NEW.vetting_limit IS DISTINCT FROM OLD.vetting_limit
      OR NEW.vetting_decided_on IS DISTINCT FROM OLD.vetting_decided_on OR NEW.vetting_decided_by IS DISTINCT FROM OLD.vetting_decided_by
      OR NEW.vetting_note IS DISTINCT FROM OLD.vetting_note) THEN
      RAISE EXCEPTION 'An estimator, a leader or a dev approves a company.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER gc_companies_vetting_guard BEFORE UPDATE ON public.gc_companies FOR EACH ROW EXECUTE FUNCTION public.gc_companies_vetting_guard();
  ```

  The client's copy would be `canVetGcCompany` beside `canOpenGcProjects`. An insert is not
  guarded: `gc_add_company` always writes a new company as *new*.

**B. The money on the board: settled with Helper 2.** B5-c is the gate.

- `loadGcBoardRows(projects, today, { money: canSeeGcMoney(role) })` skips the
  `gc_project_money` read for anyone outside the money team.
- `BoardRows.moneyShown` drives the board and the price card. When false, the card shows the holes
  and *Trades so far*, without the general conditions, the contingency and fee, or *Price so far*.
  The row reads *trades so far, with N holes*.
- After B5-c the client no longer reads `gc_projects`' three columns. B6-a drops them.
- Door 2 lands after B5-c and B5-d. This is no longer a call.

**B. New here? on the board: this PR or the next.**

- *My default:* the next one, right after.
- **Why:**
  - Main's board carries only the stage strip's anchors (`gc-stage-strip`, `gc-jump-*`).
  - The prototype's stops need anchors added across Helper 2's board files: `gc-board`, the stage
    titles and sections, a row, its days left, the price line, Trade partners and Follow up.
  - They also need the spike's three `SpotlightTour` additions (`numbered`, `marks`, `bullets`) for
    the owner's numbered stage titles.
  - A door PR should stay an access change.
- *The other way:* one PR. It is three times the size and touches four lanes' files.

**C. The board above the cards, or in place of them.**

- *My default:* the office sees what a dev sees today. The board's section sits above *Each project*,
  and the cards stay below.
- B3-a's plan moves the cards onto a project's own page later. When it does, door 1's walk follows
  through its thing-named anchors.

## What the tester sees

`/gc` for the office and estimators:

```
[ Trades | GC ]  GC projects  (Being built)              New here?  Open the scope book  [ New project ]

Project Board                                  ( Project Board | Trade partners | Follow up (3) )
  1 Bidding to the customer · 2 Buying out · 3 Building · Closed · Lost      ← the stage strip
  ── Bidding to the customer ───────────────────────────────────────────────
  GC test project, delete me   12 days left   $48,000 trades so far · 5 holes   …

Each project
  [ the cards, as door 1 left them, each trade with its asks row and Ask companies ]
```

- No **Devs only** chip. The page header's **Being built** says it.
- No **Trade portals** pill for the office. A dev keeps it, and only the dev's group label still
  names it.
- The price line and card follow B5-c: *trades so far* for the office, our number for the money team.

## The SQL as it will be

```sql
SET lock_timeout = '3s';

-- GC mode, door 2 (v2.NNNN): the Project Board, Trade partners, Follow up, the Ask window and the
-- company window open to the office and estimators (to-dos/gc-mode/mockups/door-2-board.md on
-- branch spike/gc-mode). B1's eight tables and B5-a's two bid-tab tables, which it kept dev only
-- "until the Board's door", swap their dev-only policy for the GC office team that door 1 named
-- once, public.gc_office_team(). The functions on them (gc_add_company,
-- gc_vet_company, gc_invite_companies, gc_office_decline, gc_record_promise, gc_keep_promise,
-- gc_keep_promises) are SECURITY INVOKER, so this is their gate too. What stays dev only, each
-- behind its own door: the trade portal links and messages (P1) and our number (gc_project_money
-- keeps gc_money_team()). anon has no grant on these tables (B1, B5-a), and the
-- append-only three keep their missing UPDATE and DELETE privileges, which no policy can open.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_companies', 'gc_company_people', 'gc_company_vetting_forms', 'gc_invites',
    'gc_quotes', 'gc_company_contacts', 'gc_trade_promises', 'gc_trade_promise_moves',
    'gc_bid_tabs', 'gc_bid_tab_views'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_dev', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_team', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()))',
      t || '_team', t);
  END LOOP;
END $$;
```

With call A's other way, the guard above follows in the same file.

**Locks.** The ten tables are quiet and no hot table is touched, so it can go in either batch.

## The role matrix, proven before the push

It runs on Helper 2's B5-a harness, `to-dos/gc-mode/scripts/pg/b5matrix.mjs` on
`spike/board-b5-matrix` (6e6e2cdd9), run as its header says:

- local Postgres (PGlite) with the GC chain through B1, B5-a and this migration, applied twice;
- the real training-mode and twin blocks;
- one user per role, each as `authenticated`.

Its door 1 stub on `gc_projects` and `gc_trade_packages` stays. Door 2's ten tables replace B1's
dev policies.

| Who | Reads companies | `gc_add_company` | `gc_vet_company` | `gc_invite_companies` | Story line insert | `gc_quotes` update | Reads bid tabs | Reads portal links | Reads `gc_project_money` |
|---|---|---|---|---|---|---|---|---|---|
| dev | rows | wrote | wrote | wrote | wrote | refused (privilege) | rows | rows | rows |
| master_technician | rows | wrote | wrote | wrote | wrote | refused (privilege) | rows | 0 | rows |
| controller | rows | wrote | wrote | wrote | wrote | refused (privilege) | rows | 0 | rows |
| assistant | rows | wrote | wrote (call A) | wrote | wrote | refused (privilege) | rows | 0 | 0 |
| estimator | rows | wrote | wrote | wrote | wrote | refused (privilege) | rows | 0 | 0 |
| superintendent, primary, subcontractor, helpers | 0 | refused by the policy | no row | refused | refused by the policy | refused | 0 | 0 | 0 |
| controller, estimator (training mode) | rows | refused (training mode) | refused | refused | refused | refused | rows | 0 | rows / 0 |
| estimator (digital twin) | rows | refused by the fence | refused | refused | refused | refused | rows | 0 | 0 |
| anon | permission denied | — | — | — | — | — | — | — | — |

The doc keeps the table as it came out, with the words each refusal said.

## Verify after the push

1. **The catalog, read only.**
   - Each of the ten tables has one `<table>_team` policy with both expressions
     `( SELECT gc_office_team() AS gc_office_team)`, and no `_dev`.
   - `gc_trade_portal_links` and `gc_trade_messages` still read `_dev`, and `gc_project_money`
     still reads `gc_project_money_team`.
   - The seven functions read `prosecdef` false.
   - `anon` has no privilege on the ten tables.
2. **Reads per role, rolled back** (B5-a's block, the claim set before `SET LOCAL ROLE`):
   - `gc_companies` and `gc_invites` counts: rows as an estimator and an assistant, 0 as a
     superintendent and a primary.
3. **Writes per role, rolled back:**
   - an estimator's `gc_add_company` returns an id and reads back;
   - a training account's is refused (*training*), a twin's by the fence, and a superintendent's by
     the policy.
4. **The page**, a dev through **View as…**:
   - *Sample estimator:* `/gc` shows **Project Board**, **Trade partners** and **Follow up** with no
     **Trade portals** pill. The test project is under Bidding, and its price card has no fee lines
     (B5-c's gate). Trade partners lists the test company; its window opens on About. The Ask window opens
     on the test project's Concrete and is closed unsent. The outcome strip shows *We sent our bid*.
   - *Sample controller:* the price card shows General conditions and the fee.
   - *Sample primary:* `/gc` lands on the Dashboard.
5. **The boundaries that stay**, rolled back: as an estimator, `gc_trade_portal_links` and
   `gc_project_money` each read 0 rows, and `gc_bid_tabs` reads its rows. As a controller,
   `gc_project_money` reads its row.

## The PR

**Title:** `v2.NNNN GC mode, door 2: the Project Board, Trade partners, Follow up and the Ask window
open to the office and estimators (migration <stamp>)`

**Files:**

- The migration and `docs/migrations/<stamp>_gc_door_2_board_team.md`: what it opens, what stays,
  the matrix as it came out, the five steps, and the rollback. The rollback re-creates the eight
  `_dev` policies from `20261008020000` and drops the `_team` ones.
- `src/pages/GcProjects.tsx`:
  - `role === 'dev'` on the board section and on each trade's asks row becomes
    `canOpenGcProjects(role)`;
  - the outcome strip's dev gate becomes `canOpenGcProjects` (B5's call D);
  - our number keeps `canSeeGcMoney`;
  - the **Trade portals** pill and view keep `role === 'dev'`;
  - the **Devs only** chip goes;
  - the group label reads *Project Board, Trade partners or Follow up* for the office.
- `GcCompanyWindow.tsx` (#4952): its one dev gate becomes `canOpenGcProjects`, unless it guards the
  portal link, in which case it stays.
- `docs/ACCESS_CONTROL.md`:
  - the GC projects section gains door 2: the ten tables, the functions, the money gate (B5-c),
    what stays and why;
  - the Page Access Matrix row is unchanged, since `/gc` already opens to the same roles.
- `docs/twins/APP_DIRECTORY.md` (`/gc`: the board, Trade partners and Follow up for the office) and
  `PROJECT_DOCUMENTATION.md` §20.
- **The guides**, each with `roles: dev, master_technician, assistant, controller, estimator` and
  its "Only a dev sees … while it is built" sentence rewritten:
  - `see-where-every-gc-project-stands`;
  - `add-a-trade-partner`;
  - `approve-a-company-new-to-us` (its "A dev approves" follows call A);
  - `ask-trade-partners-for-a-quote`;
  - `follow-up-on-a-quote-from-a-trade-partner`;
  - `look-up-a-trade-partner` (#4952).

  `share-a-trade-partner-its-portal` stays `roles: dev`. The plain-words and pronoun checks hold
  every changed line.
- The release note, *GC projects: the board, Trade partners and Follow up for the office*, and its
  fragment.

**Checks before arming:**

- the matrix above;
- vitest on `src/lib/gc`, `src/components/gc`, `GcProjects.render.test.tsx`, `helpGuide`,
  `releaseNotes` and `twins`;
- eslint, the theme check and typecheck;
- the dev server on 5306 as a dev, then through View as the sample estimator. That view shows the
  page's gates, but not the table data until the push, since RLS still says dev only.

## After it: New here? on the board (call B)

The PR right after door 2 brings back the prototype's board stops, rewritten for what is on `main`
then. It works like door 1's walk:

- anchors named for the thing;
- `tour.test.ts`'s source scan widened to the board's files;
- every body through `plainWordsFailures`.

**The stops, in order** (the words are drafted in that PR):

1. **How a job moves.** `gc-board`. The owner's three numbered stage titles, marked `1`, `2` and `3`
   on `gc-stage-title-pursuing`, `-buyout` and `-building`.
2. **Stage 1, Bidding to the customer.** `gc-stage-pursuing`.
3. **A project's row.** `gc-row-pursuing`: its days left (`gc-due-pursuing`) and its price line
   (`gc-price-pursuing`, with words that hold for both audiences of the money gate).
4. **Asking companies to quote.** `gc-asks` on the first trade's asks row: the Ask window.
5. **Follow up.** `gc-tab-followup`: the count, and each ask's story.
6. **Trade partners.** `gc-tab-partners`: Add a company and New to us.
7. **Stages 2 and 3, Closed and Lost.** One stop each, on their section titles, saying what happens
   there and that award, papers and building come next.
8. **Then door 1's stops on the first project's card**, and **See this again**.

**Leaving out until their lanes land:**

- the ring and Who to call (B2b);
- By customer (B2b);
- Trade portals (the trade wave).

**`SpotlightTour` gains the spike's `numbered`, `marks` and `bullets`.** They are additions only,
and the Bids tours' tests run unchanged.

## Is this the best we can do?

Three ways it could be better:

1. **Name the GC office's roles in SQL, and pin them as B5 did.**
   - `gc_money_team()` lists its roles, and `access.test.ts` fails when the client's copy differs.
   - `gc_office_team()` calls `is_office_or_estimator()`, so nothing checks `canOpenGcProjects`
     against it.
   - Door 2's migration could re-create `gc_office_team()` with the five roles written out (the same
     answer today), and `access.test.ts` would pin it the way it pins the money team.
   - The cost: a new office role no longer joins GC mode by itself. Someone adds it on purpose, which
     for a page with our trades' prices is arguably right.
2. **A CI check that every GC table has a door.**
   - A test reads the migrations and sorts each `gc_*` table: on the office team, the money team,
     its own predicate, or a named dev-only list with the lane that opens it.
   - A new table that ships `_dev` into a page the office already uses would fail CI, instead of
     quietly reading empty.
   - Today that would have flagged the Owner Billing tables the board's loader reads.
3. **Follow up on the Dashboard.**
   - The prototype's Needs you carried the people to chase.
   - Once door 2 is in, the office's Follow up count could join the Dashboard's Needs you as one
     line, reading the same kernel as the pill.
   - That brings the chasing to the person, not the person to `/gc`. It is a small PR after the
     walk, Board-owned or mine as the lead says.

## As built (2026-10-08, local, cuts after B5-c and B5-d)

Built on `claude/gc-door-2-board`, on B5-b's branch.

- **The lead's go:** call A goes to the owner at the default, and B and C at theirs. Better ways 1
  and 2 are taken into the PR:
  - **`gc_office_team()` names its five roles** in the same migration, the same answer as
    `is_office_or_estimator()`. `access.test.ts` holds `GC_OFFICE_TEAM` to it, as it holds the money
    team.
  - **`src/lib/gc/doors.ts`** lists every GC table: 65, with its lane and door (office, money, or
    dev with what opens it). `doors.test.ts` reads the migrations' final policies, including the
    doors' `FOREACH` loops, and classifies each by its words. It fails when a table is missing, when
    its policy says another door, or when a dev-only table names no opener. Trades mode's
    `gc_statement_email_requests`, `gc_word_asks` and `gc_word_ask_answers` are listed apart.
    Proven by breaking the list both ways.
- **One correction to this plan:** compare and carry open with the board. B5's call C, approved,
  keeps carry and plugs with the office team; only our markup is gated, through B5-c's
  `canSeeGcMoney`. The *stays dev only* table above lists our number alone.
- **`compare-quotes-and-carry-one`** joins the guides, seven in all.
- **The role matrix** ran on Helper 2's harness with this migration applied twice. It is in the
  migration doc, and it came out as planned:
  - the five office roles read and write;
  - the field roles see nothing;
  - training accounts and twins are refused;
  - `gc_quotes` is refused for everyone by privilege;
  - portal links are a dev's, and `gc_project_money` is the money team's.
- **Checks:** 1661 tests, including two new page cases (an estimator sees the board without Trade
  portals; a dev keeps it), lint and theme. Typecheck's one error is B5-b's carry columns, waiting
  on their types.

## Status

Planned 2026-10-08 by Helper 6. Read from main:

- `20261008020000` (B1: the eight tables, the seven functions, their grants);
- `20261008120000` (the three redefined, still invoker);
- `20261008050000` (the P1 tables), `20261008130000` (B5-a, `gc_money_team()`) and its doc's matrix;
- `GcProjects.tsx`'s gates and every GC table read in `src/lib/gc` and `src/components/gc`;
- `GcPriceCard.tsx`'s money rows, and #4952's files and reads;
- the six Board guides and the board's anchors against the prototype's `gcTour.ts`.

Helper 2's answers came the same day: the harness, the money gate as B5-c's, the outcome strip
and the bid tabs.

Waiting on the lead's calls, the owner's call A, and #4952, B5-b, B5-c and B5-d on main.
