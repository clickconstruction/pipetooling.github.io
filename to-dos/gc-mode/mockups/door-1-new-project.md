---
name: "Door 1: New project, the plans, the questions and the scope book open to the office and estimators"
rows: PLAN_2026-10-07.md, Helper 6's row; NEW_PROJECT_REAL_BUILD.md decision 2 (who sees a GC project); SCHEDULE_REAL_BUILD.md, Who may read and write (G-133) and its PR 10, the pattern for a door
branch: the plan on spike/door-1-plan (from origin/spike/gc-mode at e8f61a36f); the PR from origin/main when the lead says go, one PR, its own migration
status: plan 2026-10-07 by Helper 6 at the lead's ask. Nothing cut, nothing claimed. Three calls for the lead below, one of them the owner's.
---

# Door 1: New project opens to the office and estimators

## What it is

One PR from `main` that lets the office and estimators use what New project's real build already
put on `/gc` behind the dev door: **New project**, **A new set of plans came in**, **The plans**,
**Questions about the plans** and **the scope book**. Nothing new is drawn. The door changes who
may open it and who the database lets in.

- **One migration**, `<stamp>_gc_door_1_new_project_team.sql`:
  - `public.gc_office_team()`, the GC office team named once (call C);
  - the twelve New project tables swap their `is_dev()` policy for one team policy, and `anon`
    loses its grants;
  - the GC team reads the `projects` row of a GC project (estimators reach no project today);
  - `gc_create_project` runs as its owner behind the same gate, and files a customer named for the
    first time under the company owner (call B, and *What the lead asked* below says why).
- **The page and the route**: `/gc`'s gate, the estimators' route list, and a **GC projects**
  button on Bids for the same five roles.
- **The two edge functions** refuse a training account and a digital twin.
- **The docs in the same PR**: `ACCESS_CONTROL.md`, `docs/twins/APP_DIRECTORY.md`,
  `PROJECT_DOCUMENTATION.md`, `GLOSSARY.md`, `EDGE_FUNCTIONS.md`, the migration doc, the five
  guides, a release note and its fragment.
- **No types change.** `gc_office_team()` is called only inside SQL, and `gc_create_project` keeps
  its name and its one `jsonb` argument. So the PR does not wait on a types PR, and the next PR on
  the lane does not wait on this one's.

## What the lead asked

### Which role predicate

`is_office_or_estimator()`: dev, the leaders (`master_technician`), the assistants, the controller
and estimators. It is the schedule's default, the set `gc-drive-access` and
`gc-plan-question-email` already admit (`OFFICE_ROLES` in both), and the set *Checked by* already
lists (`TEAM_ROLES` in `gcIo.ts`, plus superintendents). Superintendents, primaries, subcontractors
and helpers get nothing.

**Where New project differs from the schedule:** decision 2 of `NEW_PROJECT_REAL_BUILD.md`, which
the owner took on 2026-10-04, says *dev, master and controller*, because a project carries money
(budgets, our number and its fee). It leaves estimators and superintendents to a later view
without money, and lets the scope book open to estimators first. Opening to the office and
estimators changes a decision the owner took, so it is **call A**, and it goes to him. What money
the door shows today: only the trades' **budgets** (step 3 and the project's card). Our number,
its fee, contingency and general conditions have columns on `gc_projects` but no screen until the
Board's B5.

### Do the RPCs need their own role check?

**They are `SECURITY INVOKER`, not `SECURITY DEFINER`**: `gc_create_project`, `gc_issue_plan_set`,
`gc_record_question`, `gc_answer_question` and `gc_questions_close_on` all run as the caller, so the
tables' policies are their role check. The swap opens four of them with no change.

`gc_create_project` is the exception, because it also writes `customers` and `projects`, which keep
their own rules:

| Who | Picks a customer from the list | Names someone new (customer, architect or the property's owner) |
|---|---|---|
| dev, leader | works | works |
| assistant, controller | works after the swap (`projects` lets `is_office_staff()` insert) | **refused**: the `customers_master_role_check` trigger wants a dev or leader as `master_user_id`, and the RPC writes the caller's own id |
| estimator | **refused**: `projects` INSERT is `is_office_staff()` or older role branches, none an estimator | **refused** twice: as above, and the estimators' `customers` INSERT policy wants a dev or leader as master |

Estimators also cannot **read** a GC project's `projects` row: its `master_user_id` is null, and
`can_access_project_row` answers false for a null master unless the caller is office staff. The
page would load the GC rows and find no names.

So `gc_create_project` gets its own gate (call B): `SECURITY DEFINER`, `gc_office_team()` or
refuse, a training account and a twin refused in words, and a new customer filed under
`company_owner_user_id()`, as every new customer has been since one company (v2.2967). The
`customers` guard is still met: the company owner is a leader.

### The edge functions

Both already admit the five roles. Both use the service role, so the read-only blocks and the twin
fence never see their writes:

- `gc-plan-question-email` sends a real email to the architect and stamps the question sent;
- `gc-drive-access` makes Drive folders, shares **Plans** with anyone who has the link, and writes
  `gc_projects.drive_folder_url` and a set's three Drive columns.

While the page was dev-only, nobody in training mode could reach them. After the door, a training
account or a twin could. Each reads `read_only` and `is_digital_twin` with the role and refuses:

- `gc-plan-question-email`: *A training account cannot send email.* (`send-lien-desk-summary`'s
  words), and *A digital twin cannot send email.*
- `gc-drive-access`: *A training account cannot change Drive or the project.*, and the same for a twin.

Sample accounts are let through on purpose: a dev imitating the sample estimator is how step 4
below walks the door. Nothing in `_shared/` changes, so no other function goes behind. The lead
deploys both after the merge with `scripts/deploy-functions.sh`; `config.toml` already holds their
`verify_jwt = false` blocks.

## Three calls for the lead

**A. Who, against decision 2 (the owner's).** *My default:* the office and estimators, as the lead
asked. Budgets are estimating numbers, and estimators already read a bid's cost and margin in
Trades mode (`is_pricing_sharer()`). The fee is the one number decision 2 guards, and no screen
shows it yet; better way 2 below keeps it guarded when B5 lands. *The other way:* dev, master and
controller (decision 2 as taken), plus the scope book alone to estimators. That swaps
`gc_office_team()`'s body for the narrower one and drops the button for assistants and estimators.
Everything else in this plan stays. **The owner says which before the cut**, since the testers' roles
depend on it (his question 2).

**B. `gc_create_project` as definer.** *My default:* yes, as above. *The other way:* keep it
invoker, fix only the company-owner stamp, and leave estimators out of making a project. They
would still need the `projects` read policy to see the page. That gives a door where estimators read
and an assistant makes the project, which is a stranger first test than everyone making one.

**C. Name the audience once.** *My default:* `public.gc_office_team()`, today
`SELECT public.is_office_or_estimator()`, and every policy calls it. If the owner narrows or widens
the GC office later (call A, or B5's money), it is one `CREATE OR REPLACE FUNCTION`, not twelve
policy swaps and a projects policy. Helper 1's `gc_on_schedule_team()` can call it for its office
branch, so New project and the schedule never disagree. *The other way:* write
`public.is_office_or_estimator()` in each policy, as the schedule's plan does. If the lead says no,
the SQL below reads `public.is_office_or_estimator()` wherever it says `public.gc_office_team()`,
and section 1 goes.

## What the tester sees

**Bids** (`/bids`), for dev, leader, assistant, controller and estimator. A button sits beside
**New Bid** in both header layouts, and wraps with it on a phone:

```
[ Bid Board | Counts | Takeoffs | … ]                    ( GC projects )  [ New Bid ]
```

- Words: **GC projects**. Hover: *We are the general contractor. Trades quote to us.*
- `{{button:outline|GC projects}}` in the guides.
- It goes to `/gc`. The Trades | GC switch replaces it in the next PR on this lane.

**GC projects** (`/gc`): the page as it is, with two changes.

- The header chip *dev only, the real build* now reads **Being built**, with the hover *GC mode
  is new. Tell the office what you find.*
- Anyone else lands on the Dashboard, as today.

**How a tester gets there**: the **GC projects** button on Bids; the link in each guide
(`[GC projects](/gc)`); and the lead's evening note with `https://clicktooling.com/gc` and the guide
links. A phone that still holds an older build needs one reload before the button shows.

## The SQL as it will be

```sql
SET lock_timeout = '3s';

-- GC mode, door 1 (v2.NNNN): New project, the plans window, the questions window and the scope
-- book open to the office and estimators (to-dos/gc-mode/mockups/door-1-new-project.md on branch
-- spike/door-1-plan). Until now every New project table was dev only (decision 2 of
-- NEW_PROJECT_REAL_BUILD.md: dev only while it is built).
--   1) public.gc_office_team(): who is on GC mode's office team, named once. Today it is
--      is_office_or_estimator(): dev, the leaders, the assistants, the controller and estimators.
--   2) The twelve tables swap their dev-only policy for one team policy, and anon loses its grants.
--   3) The team reads the projects row of a GC project (the office already reads every project;
--      an estimator read none, since a GC project's master_user_id is null).
--   4) gc_create_project runs as its owner behind the same gate, refuses a training account and a
--      digital twin, and files a customer named for the first time under the company owner, as
--      every new customer is since one company (v2.2967). Before, only a dev or a leader could name
--      someone new (the customers guard refuses any other master_user_id), and an estimator could
--      not write the projects row at all.
-- The other RPCs (gc_issue_plan_set, gc_record_question, gc_answer_question, gc_questions_close_on)
-- are SECURITY INVOKER and write only the twelve tables, so the policies here are their gate.

-- 1) The team.
CREATE OR REPLACE FUNCTION public.gc_office_team()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_office_or_estimator();
$$;

COMMENT ON FUNCTION public.gc_office_team() IS
  'GC mode door 1 (v2.NNNN): who may read and write the New project tables, named once. Today the office and estimators (is_office_or_estimator()). Change the audience here, never in the policies.';

REVOKE EXECUTE ON FUNCTION public.gc_office_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_office_team() TO authenticated, service_role;

-- 2) The twelve tables: one policy each for every verb, asked once a statement.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_projects', 'gc_trade_packages', 'gc_scope_items', 'gc_scope_exclusions',
    'gc_scope_book_saved', 'gc_scope_book_edits', 'gc_scope_book_merges', 'gc_scope_sets',
    'gc_plan_sets', 'gc_plan_set_items', 'gc_plan_questions', 'gc_plan_set_sends'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_dev', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_team', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()))',
      t || '_team', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- 3) The projects row of a GC project, for the team. A second permissive SELECT policy beside
-- "Users can see projects they have access to"; it reads gc_projects, whose policy reads users
-- only, so nothing loops.
DROP POLICY IF EXISTS "GC team sees GC projects" ON public.projects;
CREATE POLICY "GC team sees GC projects" ON public.projects FOR SELECT TO authenticated
  USING ((SELECT public.gc_office_team()) AND EXISTS (SELECT 1 FROM public.gc_projects g WHERE g.project_id = projects.id));

-- 4) New project's press, behind the team's gate.
CREATE OR REPLACE FUNCTION public.gc_create_project(draft jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(draft->>'name', ''));
  v_role text := coalesce(nullif(btrim(draft->>'customerRole'), ''), 'owner');
  v_company uuid := public.company_owner_user_id();
  v_customer uuid;
  v_architect uuid;
  v_owner uuid;
  v_project uuid;
  v_pkg uuid;
  v_set uuid;
  t jsonb;
  s jsonb;
  ex jsonb;
  line text;
  sheets text[];
  specs text[];
  i integer := 0;
  j integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to make a project.';
  END IF;
  -- The gate (door 1): it runs as its owner, so it says who may, in words.
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'GC projects are for the office and estimators.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot make a project.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot make a GC project.' USING ERRCODE = '42501';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'Give the project a name.';
  END IF;
  -- The prototype spells the role ownersRep; the table spells it owners_rep.
  IF v_role = 'ownersRep' THEN
    v_role := 'owners_rep';
  END IF;
  IF v_role NOT IN ('owner', 'gc', 'owners_rep') THEN
    RAISE EXCEPTION 'Who we work for must be the owner, a general contractor or an owner''s rep.';
  END IF;
  -- Someone named for the first time is filed under the company owner (one company, v2.2967).
  IF v_company IS NULL AND (
    (nullif(btrim(coalesce(draft->>'customerId', '')), '') IS NULL AND btrim(coalesce(draft->>'ownerName', '')) <> '')
    OR (nullif(btrim(coalesce(draft->>'architectId', '')), '') IS NULL AND btrim(coalesce(draft->>'architectName', '')) <> '')
    OR (nullif(btrim(coalesce(draft->>'propertyOwnerId', '')), '') IS NULL AND btrim(coalesce(draft->>'propertyOwnerName', '')) <> '')
  ) THEN
    RAISE EXCEPTION 'Settings names no company owner, so someone new cannot be filed. Pick them from the list.';
  END IF;

  -- The customer: a record, or a company named for the first time (an ordinary commercial customer).
  v_customer := nullif(btrim(coalesce(draft->>'customerId', '')), '')::uuid;
  IF v_customer IS NULL THEN
    IF btrim(coalesce(draft->>'ownerName', '')) = '' THEN
      RAISE EXCEPTION 'Say who the customer is.';
    END IF;
    INSERT INTO public.customers (name, master_user_id, customer_type)
    VALUES (btrim(draft->>'ownerName'), v_company, 'commercial')
    RETURNING id INTO v_customer;
  END IF;

  -- The architect, the same way (decision 4: an ordinary customer row). Optional.
  v_architect := nullif(btrim(coalesce(draft->>'architectId', '')), '')::uuid;
  IF v_architect IS NULL AND btrim(coalesce(draft->>'architectName', '')) <> '' THEN
    INSERT INTO public.customers (name, master_user_id, customer_type)
    VALUES (btrim(draft->>'architectName'), v_company, 'commercial')
    RETURNING id INTO v_architect;
  END IF;

  -- The property's owner, when someone other than the customer. Optional.
  v_owner := nullif(btrim(coalesce(draft->>'propertyOwnerId', '')), '')::uuid;
  IF v_owner IS NULL AND btrim(coalesce(draft->>'propertyOwnerName', '')) <> '' THEN
    INSERT INTO public.customers (name, master_user_id, customer_type)
    VALUES (btrim(draft->>'propertyOwnerName'), v_company, 'commercial')
    RETURNING id INTO v_owner;
  END IF;

  -- …from here to the end, the body of 20261007030000_gc_create_project.sql, byte for byte:
  -- the projects row, gc_projects, each trade with its scope lines and exclusions, and set 0 with
  -- its sheets and sections. RETURN v_project.
END;
$$;

COMMENT ON FUNCTION public.gc_create_project(jsonb) IS
  'GC mode: New project''s press, all or nothing. Takes the prototype''s NewProjectDraft as jsonb (name, address, customerId or ownerName, architectId or architectName, propertyOwnerId or propertyOwnerName, customerRole, bidDue, sqFt, sizeNote, setLabel, setKind, issuedOn, setNote, checkedByUserId, drive {url, access, checkedOn}, sheets, specs, trades [{trade, budget, ours, scope, scopeSheets, scopeSpecs, excludes}]) and writes the projects row, gc_projects, the trades with their scope lines and exclusions, and set 0 with every sheet and section as issued. Returns the project id. SECURITY DEFINER since door 1 (v2.NNNN): the GC office team only (gc_office_team()), never a training account or a digital twin; someone named for the first time is filed under company_owner_user_id().';

REVOKE ALL ON FUNCTION public.gc_create_project(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_create_project(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_create_project(jsonb) TO authenticated;
```

What changes in `gc_create_project`, against `20261007030000`, and nothing else:

- `SECURITY INVOKER` → `SECURITY DEFINER`;
- the `v_company` declaration;
- the gate's three refusals after *Sign in*;
- the company-owner check before the customer;
- `v_uid` → `v_company` in the three `customers` inserts;
- the two comments that said *the person making the project as its master* and *RLS decides*.

From `-- The projects row` to `END;` it is copied whole, so the lead's byte comparison is the diff
of the two files. The PR carries the whole body, not the `…` line above.

**Under the definer, what still holds:**

- `auth.uid()` still reads the caller's token, so `created_by` and `checked_by_user_id` are the
  caller's.
- The read-only **statement** triggers still fire on every table it writes. The gate's own words
  come first.
- The read-only restrictive policies and the twin fence are row security, which the owner skips.
  That is why the gate checks `is_read_only()` and `is_digital_twin()` itself.

**Locks.** Each `CREATE POLICY` and `DROP POLICY` takes its table's exclusive lock for an instant.
The twelve GC tables are quiet. `projects` is not: a long read on it makes the 3-second timeout fail
the push, so the lead pushes in the evening batch and retries if it does.

## The migration doc as it will be

`docs/migrations/<stamp>_gc_door_1_new_project_team.md`: what it adds (the four parts above), who
it lets in (the table of roles), what it does not touch (the schedule's tables stay dev only until
schedule PR 10; `customers` and `projects` keep their own policies but the new SELECT one), the five
verify steps below, the rollback, and *Applied* filled in by the lead.

## Verify after the push

The lead runs them, as for New project's other migrations. Steps 1 to 3 go through the management
API's query endpoint, inside a transaction that never commits where they write. Steps 4 and 5 run
from the app.

1. **The catalog, read only.**
   - Each of the twelve tables has exactly one policy, `<table>_team`, `FOR ALL TO authenticated`,
     both expressions `(SELECT gc_office_team() AS gc_office_team)`. No `<table>_dev` is left.
   - `has_table_privilege('anon', …)` is false for all twelve.
   - `projects` has *GC team sees GC projects* and its four other policies unchanged.
   - `gc_create_project`: `prosecdef` true, `proconfig` `{search_path=public}`, `proacl` without
     `PUBLIC` or `anon`, one `jsonb` argument.
   - The other four RPCs: `prosecdef` still false.
   - `gc_office_team()` is executable by `authenticated` and not by `anon`.
2. **An estimator and an assistant make a project, rolled back.** `BEGIN; SET LOCAL ROLE
   authenticated;` with `request.jwt.claims` naming an active estimator. Call `gc_create_project`
   with a new customer and a new architect (*Door 1 check, delete me*), one trade and one sheet.
   - It returns an id.
   - Both new customers carry `company_owner_user_id()` as master.
   - The estimator reads the project back from `projects`, `gc_projects` and `gc_plan_sets`.
   - `ROLLBACK`.
   - The same again as an assistant.

   A rolled-back call still uses one `project_number` from its sequence. That gap is harmless.
3. **Who is refused, rolled back.**
   - A training account (`read_only`): *A training account cannot make a project.*, and its plain
     insert into `gc_scope_sets` is refused by the read-only blocks.
   - A digital twin (an estimator): *A digital twin cannot make a GC project.*, and its insert into
     `gc_scope_sets` is refused by the fence.
   - A primary and a superintendent: `gc_projects` reads no rows, and `gc_create_project` says *GC
     projects are for the office and estimators.*
4. **The page, as an estimator.** Signed in as a dev, gear → **View as…** → the sample estimator.
   - Bids shows **GC projects**.
   - `/gc` lists the test project with its two sets, its trades and the recorded question.
   - **The plans**, **Questions about the plans** and **Open the scope book** open. Nothing is
     saved: a sample's writes are real rows.
   - View as the sample primary: no button on Bids, and `/gc` lands on the Dashboard.
5. **The functions, after the lead deploys them.**
   - As the sample estimator, **Check again** on the test project's set answers. It says *only
     some people can open it*, as on 2026-10-07.
   - A bare POST to `gc-plan-question-email` with no token says *Sign in first.*, so it is alive.
   - The email itself stays unsent: that is step 8b, which waits on the owner's yes.

## Rollback

A one-off migration:

- drop the twelve `_team` policies and re-create the `_dev` ones (`public.is_dev()`, as
  `20261006233000` and `20261006234000` wrote them);
- drop *GC team sees GC projects*;
- restore `gc_create_project` from `20261007030000` (the invoker body);
- keep `gc_office_team()`, which is harmless unused.

The page and the button go back with a revert of the client commit.

## The PR

**Title:** `v2.NNNN GC mode, door 1: New project, the plans, the questions and the scope book open
to the office and estimators (migration <stamp>)`

**Files:**

- `supabase/migrations/<stamp>_gc_door_1_new_project_team.sql` and its doc.
- `src/lib/gc/access.ts`: `canOpenGcProjects(role)`, true for the five roles, the client's copy of
  `gc_office_team()`. `access.test.ts` covers every role. Helper 1's Schedule tab reads it in PR 10.
- `src/pages/GcProjects.tsx`:
  - the two `role !== 'dev'` checks read `canOpenGcProjects`;
  - the chip reads **Being built**.
- `src/lib/layoutRouteAccess.ts`: `/gc` joins `estimatorAllowedPaths`. Office roles pass every
  route already. Its test gets the line.
- `src/pages/Bids.tsx`: the **GC projects** button beside **New Bid**, for `canOpenGcProjects`.
- `supabase/functions/gc-plan-question-email/index.ts` and `gc-drive-access/index.ts`:
  - the caller's row is read with `read_only, is_digital_twin`;
  - the two refusals.
- `docs/EDGE_FUNCTIONS.md`: both sections' *Auth* line.
- `docs/ACCESS_CONTROL.md`:
  - a **GC projects** row in the Page Access Matrix: ✅ dev, master, assistant, estimator; ❌ the rest;
  - a section *GC projects: New project, the plans, the questions and the scope book (door 1)*,
    with the tables, the projects read, the definer gate, the functions, and the schedule's tables
    staying dev only until its PR 10.
- `docs/twins/APP_DIRECTORY.md`: `/gc — GC projects (dev only)` → the office and estimators.
  `appDirectoryCheck.test.ts` already knows the five guide slugs.
- `docs/PROJECT_DOCUMENTATION.md`: the GC projects page's first entry. It has none. PR 4 was to
  add it while the page was dev only.
- `docs/GLOSSARY.md`: GC project, plan set, scope line, scope book, scope set. It has none yet.
- The five guides (`start-a-gc-project`, `issue-a-new-set-of-plans`,
  `read-the-plans-of-a-gc-project`, `ask-the-architect-about-the-plans`, `use-the-scope-book`):
  - `roles: dev, master_technician, assistant, controller, estimator`;
  - *Only devs see the page while the real build goes on.* becomes *The office and estimators see
    the page.* (or *the window*, *the book*, as each says now);
  - each step 1 reads *Press {{button:outline|GC projects}} on the Bids page.* and links
    [GC projects](/gc).

  The plain-words test holds every changed line.
- `src/content/releaseNotes/v2.NNNN.ts` and `docs/recent-features/v2.NNNN.md`.

**Release note**, *GC projects open to the office and estimators*:

- The GC projects page is open to the office and estimators. Press GC projects on the Bids page.
- Start a project from its plans, add a new set, read the plans and ask the architect.
- The scope book opens for the same people.
- A training account can look but cannot save or send.

**Checks before arming:**

- `VITE_SUPABASE_URL=http://x VITE_SUPABASE_ANON_KEY=x npx vitest run src/lib/gc src/components/gc
  src/lib/layoutRouteAccess src/lib/helpGuide src/lib/releaseNotes src/lib/twins`;
- `npx eslint` on the touched files;
- `node scripts/theme-tokenize.mjs --check src/components/gc src/pages`;
- `npm run typecheck` in the background, read to its exit line;
- the dev server on 5306: View as the sample estimator through `/bids` → **GC projects** → `/gc`.
  The database's half waits on the push.

## What it touches outside the lane

- **Helper 1, schedule PR 7.** Once door 1 is in, `/gc` is no longer dev only, so the Schedule tab
  must gate itself (`role === 'dev'`) until PR 10. It cannot lean on the page's gate. PR 10 then
  opens the tab with `canOpenGcProjects`, or its own superintendent and project manager rule.
- **The test rows (call 13).** Testers will see *GC test project, delete me*, its architect and its
  question. Either the owner says delete before the door, or the evening note tells testers to leave
  them alone.
- **Step 8b's email.** After the door, any of the five roles could press *Email it to GC Test
  Architects* once the architect has an address. The address goes on only with the owner's yes,
  and so the email waits with it.

## Is this the best we can do?

Three ways it could be better:

1. **Ship the Trades | GC switch in door 1 instead of a button that lives two days.** The switch is
   the spike's `BidsModeToggle`, 50 lines, with the GC side pointing at `/gc`. Testers would learn
   the real door once, and the next PR on the lane would be *New here?* instead. It costs one more
   file in this PR and a decision on where the switch sits in Bids's narrow header.
2. **Keep the money columns off `gc_projects` before B5 writes them.** After door 1, an assistant or
   an estimator can read `general_conditions`, `contingency_pct` and `fee_pct` through the API,
   though no screen shows them and every row is 0 today. If decision 2's money rule stands, B5 should
   put our number, its fee and contingency in a table of its own with the money audience, and drop
   the three columns. Then nothing door 1 opened has to close again.
3. **GC projects show on the Projects page.** `/projects` lists every `projects` row to the office,
   so the test project is there today, and every real one will be after the door. It has a name and
   a customer, and no workflow. Either the Projects page leaves out rows with a `gc_projects` twin,
   or it tags them **GC** with a link to `/gc`. The second is one join and teaches the office where
   GC projects live. Both are a small PR after the door. Neither belongs in it.

## Status

Planned 2026-10-07 by Helper 6. Read: `HANDOFF.md`, `PLAN_2026-10-07.md`,
`NEW_PROJECT_REAL_BUILD.md`, `SCHEDULE_REAL_BUILD.md` (G-133 and PR 10), `ACCESS_CONTROL.md` and
`APP_DIRECTORY.md` on main, the five New project migrations, the policies `projects` and `customers`
carry on main (`20260906200000`, `20260907050000`, `20260927220000`, the customers guard
`20260703150000`), both edge functions, the page and `gcIo.ts`, and the spike's `BidsModeToggle`.

The role table above is read from the repo's migrations, not from prod's catalog. Step 1 confirms it.

Waiting on the lead's go and calls A to C. Call A is the owner's.
