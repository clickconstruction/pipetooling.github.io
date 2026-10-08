# P4: back-charges and a trade's change requests (Portal lane)

The plan for P4 of `PORTAL_REAL_BUILD.md` (*The PRs, in order*, items 7 and 8). Two records belong to the portal:

- **A back-charge** is a charge to a trade: cleanup, damage, or work we had to finish for it. The company sees it in its portal and agrees or disputes it by its answer day.
- **A change request** is a trade asking us for a change: it hit something no one could see, the customer asked it for more, or the plans changed. The office makes it a change order to the customer or turns it down.

The kernels and their 81 words are already on main from P0:

- `backChargeState`, `backChargeCanTake`, `backChargeDraws`, `backChargesToAct` and `portalBackCharges`;
- `changeRequestState`, `openChangeRequests`, `portalCanAskChange` and `portalChangeRequests`;
- `BACK_CHARGE_ANSWER_DAYS` (5);
- the `bc*`, `cr*`, `mBc*` and `mCr*` keys.

What P4 adds is the tables, their SQL, the slice, the presses and the email words.

It comes as two PRs:

- **P4a**: the two tables, the office's three back-charge verbs, the trade's two verbs, and the doors registry. It is a migration and needs B6-a (#4973) on main.
- **P4b**: the slice, the two portal blocks and their presses, the email builders, the dashboard's two kernels, the sample and the docs. It goes after P4a's types.

## Who owns what (the seams)

| Piece | Owner | When |
|---|---|---|
| `gc_back_charges`, `gc_trade_change_requests`, the five verbs below | Portal (P4a) | after B6-a |
| The office screen that charges, keeps and drops a charge (`GcBuildingBackCharges` on the spike) | Building (Helper 4) | after P4a's types |
| Taking a charge off a draw (`gc_take_back_charge`, `taken_draw_id`'s FK) | Building (U6) | with the draws |
| `gc_draft_change_order_from_request`, `gc_turn_down_change_request`, the request list in the change orders window | Owner Billing (Helper 5) | after P4a's types |
| The trade signing the change it asked for (`gc_trade_sign_change`) | Building (U6) | with the draws |
| The award and the statement of work in the slice | Portal (P2c or P4b, whichever lands first) | after B6-a |
| The dashboard's Needs you line | Board (B2b) reads P4b's two kernels | B2b |

## P4a: the tables and their SQL

One migration, stamped at the cut. It is `SET lock_timeout = '3s';` first, idempotent, and ends with the three `apply_*` calls.

**`gc_back_charges`** (`BackCharge`):

- `id`, `project_id` (FK `gc_projects(project_id)`), `package_id` (FK, cascade), `company_id` (FK `gc_companies`, restrict).
- `sow_id` (FK `gc_sows`, restrict). The charge is on the work the company signed for.
- `amount` (> 0, cents kept), `reason` (not blank, at most 2,000), `photo_url` (a Drive link, null; no upload until P5a).
- `sent_on` (the app's day), and `answer_by`, generated as `sent_on + 5` so it cannot drift, held to `BACK_CHARGE_ANSWER_DAYS` by a test that reads the migration (`backChargesSql.test.ts`).
- `status` is one of `open`, `agreed`, `disputed`, `kept` or `dropped`.
- `answered_on` and `answer_note`: the company's answer, and its reason when it disputes.
- `settled_on`, `settled_note` and `settled_by`: the office's keep or drop.
- `taken_draw_id` (uuid, no FK until U6) and `taken_on`.
- `created_by` and `created_at`.
- CHECKs:
  - an answered status has its day;
  - a dispute has its note;
  - a kept or dropped charge has its day and note;
  - a taken charge has both its draw and its day.

**`gc_trade_change_requests`** (`TradeChangeRequest`):

- `id`, `project_id`, `package_id`, `company_id`, `sow_id`.
- `asked_on`, `description` (not blank, at most 2,000), and `reason` (`owner`, `field` or `plans`: the same CHECK as `gc_change_orders`).
- `amount` (> 0) and `days` (≥ 0).
- `file_url` (null until P5a).
- `change_order_id` (FK `gc_change_orders`, set null).
- `turned_down_on` and `turned_down_note`, with a CHECK that both are set together, never with a `change_order_id`.
- `created_at`.

**RLS and doors**: both tables are dev only (`is_dev()`), as `gc_trade_portal_links` is: one `<table>_dev` policy each, every verb. The client never deletes either record and writes only what the verbs write, in Owner Billing's column grants:

- a charge: `INSERT` on the columns the office types (the rest are defaults) and `UPDATE` on `status`, `settled_on`, `settled_note` and `settled_by`. The company's answer is the service role's, and the draw U6's;
- a request: no `INSERT` (the trade's verb is the service role's) and `UPDATE` on `change_order_id`, `turned_down_on` and `turned_down_note` only, for Owner Billing's two verbs.

- `doors.ts` gains both tables as `dev('Portal', PORTAL_OPENS)`, and `doors.test.ts` reads them from the migration.
- Owner Billing's two RPCs and Building's screen work under that policy, so they are dev only until the trade wave opens the tables.

**The office's verbs** (`SECURITY INVOKER` under the policy). Each refuses anyone but a dev first, before any other check or write, in `gc_award`'s words (`devOnly`: "Only a dev charges a trade while GC mode is built.", and *keeps a charge*, *drops a charge*), since door 2 lets the office read the trades (decision 11). Refusals are `RAISE '<key>' USING ERRCODE 'P0001', DETAIL '<words>'`, as P2a's are.

- **`gc_back_charge(p_package_id, p_amount, p_reason, p_photo_url)`**: on the package's statement of work if it is signed, else `sowNotSigned`. The company comes from the statement of work. It refuses an amount that is not above zero (`amountNeeded`), a blank reason (`descriptionNeeded`) and one past 2,000 characters (`tooLong`). It returns the id.
- **`gc_keep_back_charge(p_id, p_note)`**: only a disputed charge, or an open one past its answer day (`noAnswer`). Never a taken one. The note is needed (`noteNeeded`). An open charge before its answer day is `stillOpen`, and a taken, agreed, kept or dropped one is `alreadyAnswered`.
- **`gc_drop_back_charge(p_id, p_note)`**: any charge not dropped and not taken, a kept one too (`alreadyAnswered` otherwise). The note is needed (`noteNeeded`).

**The trade's verbs** (service role only, the link's company first, as P2a's):

- **`gc_trade_answer_back_charge(p_company_id, p_charge_id, p_agree, p_note)`**:
  - Its own charge, else `notYours`.
  - Open and not taken, else `alreadyAnswered`. An open charge can still be answered after its answer day.
  - A dispute needs its note (`noteNeeded`), and neither agree nor dispute is `badRequest`.
- **`gc_trade_ask_change(p_company_id, p_package_id, p_description, p_reason, p_amount, p_days)`**:
  - Only the company on a signed statement of work, on a job that is ours (`portalCanAskChange`'s rule), else `notAwarded`.
  - The description is needed (`descriptionNeeded`), the amount must be above zero (`amountNeeded`), the days 0 or more and the reason one of the three (`badRequest`).
  - `notAwarded` also when the statement of work's ask is not the trade's award, which `gc_award` writes together with it.

A new key the trade's verbs raise joins `TRADE_SQL_ERRORS` with its status, and the portal's words for it (`TRADE_ERROR_WORDS`) in both languages, in P4b: `notAwarded`, `alreadyAnswered`, `noteNeeded` and `descriptionNeeded`. Until then P4a's guard in `gcTradeSubmit.test.ts` lists them in `WAITING` with `'P4b'`: every key a `gc_trade_<verb>` raises is mapped there, or names the PR that maps it (decision 11). `devOnly`, `sowNotSigned` and `stillOpen` are the office's alone and never reach the portal.

**The check (P4a)**: the bed `supabase/tests/gc_back_charges/20_scenario.sql`, run on a local Postgres 15 as P2a's (90 checks, 2026-10-08) and on GitHub's `SQL beds` against the whole schema (`scripts/pgtest-gc-back-charges.sh`, decision 11). It holds every key and its words, each CHECK, each grant, a trade's own delete, and the sweep of an awarded project in one statement. Then Helper 5 runs their two RPCs on the bed and writes the request's columns under dev RLS.

## P4b: the portal's side

**The slice** gains the company's own rows, never another company's, and each field joins `TRADE_PORTAL_FIELDS`:

- **Back-charges**: every field but `created_by` and `settled_by`.
- **Change requests**: every field.
- **For each request's change order**: its `number`, `status`, `sent_on`, `answered_on` and `cost`, which is "Your part", and once U6 lands, the trade's send and signature.
  - Never its `price`, the customer's side or our fee. The never-sees test plants a price of 777,777 on the change order.
- **The award and the statement of work**, if P2c has not brought them yet:
  - the company's own award (`awarded_invite_id` only when it is theirs);
  - its statement of work's `status`, `signed_on`, `price` (its own number) and `retainage_pct`.

The mapper (`tradePortalState.ts`) then fills `pkg.awardedInviteId`, `pkg.sow`, `sow.backCharges`, `project.changeRequests` and the change orders' trade-side fields. The kernels on main read them unchanged.

**The blocks**, ports of the spike's `GcPortalBackCharges` and `GcPortalChanges`, on the project page of a trade that is theirs:

- **Charges from Click** lists each charge with its photo link. Its chip and words come from `portalBackCharges`. An open one offers **Agree** and **Dispute it**, and a dispute takes its reason.
- **Changes to your work** lists each request with `portalChangeRequests`' chip and words, and offers **Ask for a change** while `portalCanAskChange` holds. The form has what changed, why (the three reasons), the amount and the working days. The file is hidden until P5a, as the quote form's is.

**The presses**: `submit-gc-trade-portal` gains two kinds:

- `answer_back_charge` takes `chargeId`, `agree` and `note`.
- `ask_change` takes `packageId`, `description`, `reason`, `amount` and `days`.

`ask_change` joins the free-text kinds under the cap of 10 an hour; the count adds the company's change requests from the last hour. `answer_back_charge` can only happen once per charge, so it is not capped. The page re-reads quietly, as P2b-ii's presses do, and the preview posts nothing.

**The emails** (no trade press emails the trade). `tradeEmail.ts` gains two builders from the spike's `portalMessages`, and the office screens call `gc-trade-email` with them:

- **`backChargeEmail(stage, …)`**, kind `backCharge` (pay):
  - `sent` (`mBcSubject`, `mBcWhat`, `mBcAnswer`, `mBcOpen`), key `<charge id>:sent`;
  - `settled` (`mBcKept…` or `mBcDropped…`), key `<charge id>:settled`;
  - `taken` (`mBcTaken…`), key `<charge id>:taken`. That one is U6's to press.
- **`changeAskEmail(stage, …)`**, kind `changeAsk` (contracts):
  - `down` (`mCrDown…`), key `<request id>:down`;
  - `sent` (`mCrSent…`, with its part), key `<request id>:sent`;
  - `no` (`mCrNo…`), key `<request id>:no`.
- Building's screen sends `sent` and `settled`. Owner Billing's answers send `down`, `sent` and `no`.

**The dashboard**: the spike's `gcBackChargesWaiting.ts` and `gcChangeRequestsWaiting.ts` are lifted to `src/lib/gc/`, with their tests and `BACK_CHARGE_LATE_DAYS` (7). The Needs you line itself is the Board's B2b, which reads them. Until then the office sees each on its own screen.

**The sample**: the sample company gains a second sample project that is ours, with its award, a signed statement of work, one open back-charge with a photo link, and one change request with the customer. What customers see then shows both blocks. The sample's ids stay uuids, and a sample press answers ok and writes nothing.

## Errors, as keys

| Key | Status | When |
|---|---|---|
| `sowNotSigned` | 409 | the office charges a package with no signed statement of work |
| `notAwarded` | 409 | a company asks for a change on work that is not its signed statement of work |
| `alreadyAnswered` | 409 | a charge that is not open, or is taken |
| `noteNeeded` | 400 | a dispute, a keep or a drop with no note |
| `descriptionNeeded` | 400 | a change request with no words |
| `amountNeeded` | 400 | (exists) an amount not above zero |
| `notYours` | 409 | (exists) another company's charge or package |
| `notFound` | 404 | (exists) no trade or no charge with that id |
| `tooLong` | 400 | (exists) a reason, a note or a description past 2,000 characters |
| `badRequest` | 400 | (exists) neither agree nor dispute, a fourth reason, days below zero |
| `devOnly` | office only | anyone but a dev calls an office verb, said first |
| `stillOpen` | office only | the office keeps an open charge before its answer day |

## Tests

- **P4a**:
  - the SQL bed's scenario, with each refusal and its words, each CHECK and each grant, locally and on GitHub;
  - `doors.test.ts` with the two tables;
  - `backChargesSql.test.ts`: the migration's answer days equal `BACK_CHARGE_ANSWER_DAYS`, its statuses `BackCharge`'s, and its reasons `PORTAL_CHANGE_WHY`'s and `gc_change_orders`';
  - the guard in `gcTradeSubmit.test.ts`, with its `WAITING` list.
- **P4b**:
  - **Slice and mapper**: the slice's never-sees test with the change order's price planted; the mapper filling `sow.backCharges` and `changeRequests`.
  - **Submit function**: `parseTradeSubmit`'s two kinds, good and bad; the cap counting change requests.
  - **Portal blocks**: render tests for agree, dispute and its note, the ask form, and the preview posting nothing.
  - **Emails**: `gcTradeEmail.test.ts`'s cases for the two builders' words, keys and groups.
  - **Dashboard**: the two lifted waiting kernels' tests.
  - **Sample**: the sample's two blocks.

## Docs

- **P4a**: the migration's doc with its Status, ACCESS_CONTROL's trade portal section (who writes each table; line 147's pill phrase went with #5027), GLOSSARY's back-charge and change request, the bed's script with its `SQL beds` job and npm script, a release note and its fragment.
- **P4b**:
  - EDGE_FUNCTIONS for the two kinds, and `gc-trade-email`'s two new kinds of words;
  - PROJECT_DOCUMENTATION's portal paragraph;
  - the guides `see-what-a-trade-partner-sends-from-its-portal` (a dispute, a change request) and `share-a-trade-partner-its-portal` (what it can do);
  - a release note and its fragment.
- The office guides ("charge a trade partner for cleanup or damage", "answer a trade partner's change request") ship with the screens that hold those presses: Building's and Owner Billing's.

## The live check

- **P4a**: the lead pushes the migration. Helper 5's two RPCs run against it on the test project under dev RLS.
- **P4b**, once Building's screen is in, the prototype's Iron Horse walk on the test company:
  1. charged $1,250;
  2. disputed in the portal with a note;
  3. the Needs you count after 7 days (or the kernel on a moved day);
  4. kept with a note;
  5. the `settled` email.
  A change request is asked in the portal, appears on Owner Billing's list with only "Your part" on the trade's side, and is turned down, with its `down` email. The live emails wait on call 3 as every send does.

## Decisions (defaults; say if any is wrong)

1. **P4a waits for B6-a.** A charge and a request hang on a signed statement of work (`gc_sows`).
2. **Both tables stay dev only** until the trade wave, in `doors.ts`. The office verbs are `SECURITY INVOKER`.
3. **Taking a charge off a draw is U6's**, including `taken_draw_id`'s FK. P4a leaves the columns.
4. **The office screens are their lanes'**: Building's for charges, Owner Billing's for requests. P4b builds only the portal's side, plus the email builders those screens call.
5. **The Needs you line is the Board's B2b**, reading P4b's two lifted kernels.
6. **No files until P5a**: a photo is a typed Drive link, and a change request carries none.
7. **The award and the statement of work join the slice** in whichever of P2c and P4b is cut first.
8. **A change request never becomes a statement of work line on its own.** Its change order does: the customer signs, U6 sends the change to the trade (`gc_change_order_trade_sends.sow_line_id`), and the line's source is `gc_sow_lines.change_order_id`. So `gc_sow_lines` keeps its two sources, and P4 adds no column there (Helper 2, 2026-10-08).
9. **"Signed" is `gc_sows.status = 'signed'`**, never a row that merely exists. A drafted, sent or cancelled one does not count. `notAwarded` reads `gc_sows.company_id` with `gc_trade_packages.awarded_invite_id`, which `gc_award` writes together (Helper 2).
10. **Owner Billing's two verbs** (Helper 5, 2026-10-08, its O3b, after P4a's types):
    - `gc_draft_change_order_from_request(p_request_id uuid, p_draft jsonb)` takes O3's draft shape: description, cost, price, days, schedule and planSetId.
      - The window prefills cost and days from the request, and price with `changeOrderPrice`. The office can type over any of them, and the client sends the price it shows.
      - The reason and the trade come from the request. A draft that names another trade or reason is refused.
      - In one transaction it locks the request, refuses one already drafted or turned down, calls `gc_draft_change_order`, and writes `change_order_id`.
    - `gc_turn_down_change_request(p_request_id, p_note)` refuses a blank note and the same two states.
    - `change_order_id`'s FK is set null, so deleting a draft frees the request to be drafted again.
    - After Owner Billing's door, `gc_change_orders` is the money team's. So drafting from a request, and by Helper 5's default turning one down, needs the money team even once the trade wave opens this table to the office to read.
11. **The lead's four calls on P4a's read-back** (GC MODE, 2026-10-08):
    - the guard stays. Whichever of Building's U4a and P4a lands second lists the other's keys in `WAITING` (U4a's `notYourMove` and `fileNeeded` wait on P5);
    - the office's three refuse anyone but a dev first, in `gc_award`'s words. The trade's two keep the company check first;
    - `answer_by` is a generated column;
    - the whole-schema bed runs on GitHub beside the local one.
12. **`sow_id` and `company_id` stay `ON DELETE RESTRICT`.** B6-a moved its own statement of work's keys to NO ACTION, because a check queued before a cascade refused its sweep. Here the charges and requests go by cascade from `gc_projects` and from their trade, before the statement of work's own check runs, so the bed's sweep of an awarded project passes, and so does a trade's own delete (both in the bed).

## Status

Plan written 2026-10-08 by Helper 3 (the Portal lane), with decisions 8 to 10 from Helpers 2 and 5 the same morning.

**Amended 2026-10-08, evening, by Helper 13** (the Portal lane after the handoff), after the lead approved P4a's read-back (decision 11): the dev-only refusal on the office's three, the generated answer day, the bed on GitHub and the guard; the keys `devOnly` and `stillOpen` named; the column grants; and the SQL as built below. P4a cuts after B6-a's push (the morning batch after 09:10 UTC on 10-09) and its types PR. The stamp is claimed at the cut.

## P4a's SQL as built

`supabase/migrations/<stamp>_gc_back_charges_change_requests.sql`, prepared on main at 133717ab8 over B6-a at a175d6a69, word for word. The stamp is `20261009190000` until it is claimed at the cut. A difference between the migration and this block that is not a comment or the stamp is a question for the Portal lane.

```sql
SET lock_timeout = '3s';

-- GC mode, the trade partner portal's P4a (to-dos/gc-mode/mockups/portal-p4.md on branch spike/gc-mode):
-- the portal's two records, each on the work a trade signed for (B6-a's gc_sows).
--   - A back-charge is a charge to a trade: cleanup, damage, or work we had to finish for it. The office
--     charges it on Building's screen, the company agrees or disputes it in its portal by its answer day,
--     and the office keeps or drops it. Taking it off a draw is U6's, which gives taken_draw_id its FK.
--   - A change request is a trade asking us for a change on that work. The office makes it a change order
--     to the customer or turns it down (Owner Billing's O3b, under this table's policy).
-- Dev only until the trade wave (src/lib/gc/doors.ts). The office's verbs are SECURITY INVOKER under the
-- tables' policy, and refuse anyone but a dev first, in words, as gc_award does. The trade's two are the service role's alone, as P2a's are: the submit function
-- has already turned the link into its company, and each verb takes that company first. A refusal raises
-- a key the page says in the company's language (decision 11), with the reason in plain words as its
-- DETAIL. Doc: docs/migrations/.

-- A charge to a trade (BackCharge).
CREATE TABLE IF NOT EXISTS public.gc_back_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE RESTRICT,
  -- The statement of work it is on: the work the company signed for.
  sow_id uuid NOT NULL REFERENCES public.gc_sows(id) ON DELETE RESTRICT,
  amount numeric NOT NULL
    CONSTRAINT gc_back_charges_amount_positive CHECK (amount > 0),
  -- What it is for, in the office's words.
  reason text NOT NULL
    CONSTRAINT gc_back_charges_reason_said CHECK (btrim(reason) <> '' AND char_length(reason) <= 2000),
  -- The photo sent with it, a Drive link. Null: none (no upload until P5a).
  photo_url text,
  -- The app's day it was sent, and the day to answer by: BACK_CHARGE_ANSWER_DAYS later
  -- (src/lib/gc/portal.ts; src/lib/gc/backChargesSql.test.ts reads the number on the next line).
  sent_on date NOT NULL,
  answer_by date NOT NULL GENERATED ALWAYS AS (sent_on + 5) STORED,
  status text NOT NULL DEFAULT 'open'
    CONSTRAINT gc_back_charges_status_known CHECK (status IN ('open', 'agreed', 'disputed', 'kept', 'dropped')),
  -- The company's answer: the day, and its reason when it disputes.
  answered_on date,
  answer_note text,
  -- The office's keep or drop: the day, why, and who.
  settled_on date,
  settled_note text,
  settled_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- The draw it came off, and the day. U6 adds the draw's FK and the verb that writes them.
  taken_draw_id uuid,
  taken_on date,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_back_charges_answer_dated CHECK (status NOT IN ('agreed', 'disputed') OR answered_on IS NOT NULL),
  CONSTRAINT gc_back_charges_dispute_says_why CHECK (status <> 'disputed' OR btrim(coalesce(answer_note, '')) <> ''),
  CONSTRAINT gc_back_charges_settled_says_why CHECK (status NOT IN ('kept', 'dropped') OR (settled_on IS NOT NULL AND btrim(coalesce(settled_note, '')) <> '')),
  CONSTRAINT gc_back_charges_taken_dated CHECK ((taken_draw_id IS NULL) = (taken_on IS NULL))
);

COMMENT ON TABLE public.gc_back_charges IS
  'GC mode (P4a): a charge to a trade on its signed statement of work (BackCharge): cleanup, damage, or work we had to finish for it. The company agrees or disputes it in its portal by answer_by; the office keeps or drops it; U6 takes it off a draw. Written by gc_back_charge, gc_keep_back_charge, gc_drop_back_charge and the service role''s gc_trade_answer_back_charge. Dev only while it is built.';

CREATE INDEX IF NOT EXISTS gc_back_charges_sow_idx ON public.gc_back_charges (sow_id);
CREATE INDEX IF NOT EXISTS gc_back_charges_company_idx ON public.gc_back_charges (company_id);

-- A change a trade asked us for from its portal (TradeChangeRequest).
CREATE TABLE IF NOT EXISTS public.gc_trade_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE RESTRICT,
  -- The statement of work it would change: the work the company signed for.
  sow_id uuid NOT NULL REFERENCES public.gc_sows(id) ON DELETE RESTRICT,
  asked_on date NOT NULL,
  -- What changed, in the trade's words.
  description text NOT NULL
    CONSTRAINT gc_trade_change_requests_described CHECK (btrim(description) <> '' AND char_length(description) <= 2000),
  -- Why, the three a change order to the customer carries.
  reason text NOT NULL
    CONSTRAINT gc_trade_change_requests_reason_known CHECK (reason IN ('owner', 'field', 'plans')),
  -- What the trade asks for the work, and the working days it adds.
  amount numeric NOT NULL
    CONSTRAINT gc_trade_change_requests_amount_positive CHECK (amount > 0),
  days integer NOT NULL DEFAULT 0
    CONSTRAINT gc_trade_change_requests_days_counted CHECK (days >= 0),
  -- The file sent with it, a Drive link. Null: none (no upload until P5a).
  file_url text,
  -- The office's answer: the change order it made of it, or the day it turned it down and why. Deleting
  -- the draft frees the request to be drafted again.
  change_order_id uuid REFERENCES public.gc_change_orders(id) ON DELETE SET NULL,
  turned_down_on date,
  turned_down_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_trade_change_requests_turned_down_says_why CHECK (
    (turned_down_on IS NULL AND turned_down_note IS NULL)
    OR (turned_down_on IS NOT NULL AND btrim(coalesce(turned_down_note, '')) <> '')
  ),
  CONSTRAINT gc_trade_change_requests_one_answer CHECK (turned_down_on IS NULL OR change_order_id IS NULL)
);

COMMENT ON TABLE public.gc_trade_change_requests IS
  'GC mode (P4a): a change a trade asked for from its portal on its signed statement of work (TradeChangeRequest). The office makes it a change order to the customer (change_order_id) or turns it down (turned_down_*), through Owner Billing''s two verbs. Written by the service role''s gc_trade_ask_change. Dev only while it is built.';

-- The company's own, newest first, and the submit function's hourly count.
CREATE INDEX IF NOT EXISTS gc_trade_change_requests_company_idx ON public.gc_trade_change_requests (company_id, created_at);
CREATE INDEX IF NOT EXISTS gc_trade_change_requests_project_idx ON public.gc_trade_change_requests (project_id);

ALTER TABLE public.gc_back_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_trade_change_requests ENABLE ROW LEVEL SECURITY;

-- Dev only until the trade wave. Building's screen and Owner Billing's two verbs work under these.
DROP POLICY IF EXISTS gc_back_charges_dev ON public.gc_back_charges;
CREATE POLICY gc_back_charges_dev ON public.gc_back_charges FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_trade_change_requests_dev ON public.gc_trade_change_requests;
CREATE POLICY gc_trade_change_requests_dev ON public.gc_trade_change_requests FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));

-- The client writes through the verbs and never deletes. A charge is made with what the office types,
-- the rest by default, and is kept or dropped in its settled columns. The company's answer is written
-- with the service role, and the draw it came off by U6. A request is the trade's, through the service
-- role, and the office answers it in its own columns.
REVOKE ALL ON TABLE public.gc_back_charges, public.gc_trade_change_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.gc_back_charges, public.gc_trade_change_requests FROM authenticated;
GRANT INSERT (project_id, package_id, company_id, sow_id, amount, reason, photo_url, sent_on) ON TABLE public.gc_back_charges TO authenticated;
GRANT UPDATE (status, settled_on, settled_note, settled_by) ON TABLE public.gc_back_charges TO authenticated;
GRANT UPDATE (change_order_id, turned_down_on, turned_down_note) ON TABLE public.gc_trade_change_requests TO authenticated;

-- Charge a trade (the prototype's backCharge, on Building's screen): on its statement of work once it is
-- signed. The company is the one on it. Returns the charge's id.
CREATE OR REPLACE FUNCTION public.gc_back_charge(p_package_id uuid, p_amount numeric, p_reason text, p_photo_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_sow public.gc_sows%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_id uuid;
BEGIN
  -- Dev only while GC mode is built. Door 2 lets the office read the trades, so the refusal is said here,
  -- before any write, as gc_award says it, rather than left to the tables' policy.
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'devOnly' USING ERRCODE = 'P0001', DETAIL = 'Only a dev charges a trade while GC mode is built.';
  END IF;
  SELECT k.project_id INTO v_project_id FROM public.gc_trade_packages k WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No trade with that id.';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id;
  IF v_sow.id IS NULL OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'sowNotSigned' USING ERRCODE = 'P0001', DETAIL = 'A charge goes on signed work. This trade''s statement of work is not signed.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amountNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type the charge''s amount.';
  END IF;
  IF v_reason = '' THEN
    RAISE EXCEPTION 'descriptionNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say what the charge is for.';
  END IF;
  IF char_length(v_reason) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the reason under 2,000 characters.';
  END IF;
  INSERT INTO public.gc_back_charges (project_id, package_id, company_id, sow_id, amount, reason, photo_url, sent_on)
  VALUES (v_project_id, p_package_id, v_sow.company_id, v_sow.id, p_amount, v_reason, nullif(btrim(coalesce(p_photo_url, '')), ''), public.app_today())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Keep a charge (the prototype's settleBackCharge, keep): after the company disputed it, or when its
-- answer day went by with no answer. Never one taken off a draw. The note says why it stands.
CREATE OR REPLACE FUNCTION public.gc_keep_back_charge(p_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_back_charges%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  -- Dev only while GC mode is built. Door 2 lets the office read the trades, so the refusal is said here,
  -- before any write, as gc_award says it, rather than left to the tables' policy.
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'devOnly' USING ERRCODE = 'P0001', DETAIL = 'Only a dev keeps a charge while GC mode is built.';
  END IF;
  SELECT * INTO v FROM public.gc_back_charges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No charge with that id.';
  END IF;
  IF v.taken_on IS NOT NULL THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'That charge came off a draw already.';
  END IF;
  IF v.status = 'open' AND public.app_today() <= v.answer_by THEN
    RAISE EXCEPTION 'stillOpen' USING ERRCODE = 'P0001', DETAIL = format('The company has until %s to answer it.', to_char(v.answer_by, 'Mon FMDD'));
  END IF;
  IF v.status NOT IN ('open', 'disputed') THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = CASE v.status
      WHEN 'agreed' THEN 'The company agreed to that charge already.'
      ELSE format('That charge is %s already.', v.status) END;
  END IF;
  IF v_note = '' THEN
    RAISE EXCEPTION 'noteNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say why the charge stands.';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the note under 2,000 characters.';
  END IF;
  UPDATE public.gc_back_charges
  SET status = 'kept', settled_on = public.app_today(), settled_note = v_note, settled_by = auth.uid()
  WHERE id = v.id;
END;
$$;

-- Drop a charge (the prototype's settleBackCharge, drop): any charge not dropped yet and not taken off a
-- draw, a kept one too. The note says why.
CREATE OR REPLACE FUNCTION public.gc_drop_back_charge(p_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_back_charges%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  -- Dev only while GC mode is built. Door 2 lets the office read the trades, so the refusal is said here,
  -- before any write, as gc_award says it, rather than left to the tables' policy.
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'devOnly' USING ERRCODE = 'P0001', DETAIL = 'Only a dev drops a charge while GC mode is built.';
  END IF;
  SELECT * INTO v FROM public.gc_back_charges WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No charge with that id.';
  END IF;
  IF v.taken_on IS NOT NULL THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'That charge came off a draw already.';
  END IF;
  IF v.status = 'dropped' THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'That charge is dropped already.';
  END IF;
  IF v_note = '' THEN
    RAISE EXCEPTION 'noteNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say why the charge is dropped.';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the note under 2,000 characters.';
  END IF;
  UPDATE public.gc_back_charges
  SET status = 'dropped', settled_on = public.app_today(), settled_note = v_note, settled_by = auth.uid()
  WHERE id = v.id;
END;
$$;

-- The company agrees to a charge or disputes it (tradeAnswerBackCharge): its own charge, still open and
-- not taken off a draw, even after its answer day. A dispute says why.
CREATE OR REPLACE FUNCTION public.gc_trade_answer_back_charge(p_company_id uuid, p_charge_id uuid, p_agree boolean, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_back_charges%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  SELECT * INTO v FROM public.gc_back_charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No charge with that id.';
  END IF;
  IF v.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That charge is another company''s.';
  END IF;
  IF v.status <> 'open' OR v.taken_on IS NOT NULL THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'That charge has its answer already.';
  END IF;
  IF p_agree IS NULL THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Say whether the company agrees.';
  END IF;
  IF NOT p_agree AND v_note = '' THEN
    RAISE EXCEPTION 'noteNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say why the company disputes it.';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the note under 2,000 characters.';
  END IF;
  UPDATE public.gc_back_charges
  SET status = CASE WHEN p_agree THEN 'agreed' ELSE 'disputed' END, answered_on = public.app_today(), answer_note = v_note
  WHERE id = v.id;
END;
$$;

-- The company asks for a change on its work (tradeAskChange): only on a trade whose statement of work it
-- signed, on a job that is ours (portalCanAskChange). What changed, why, what it asks and the working days
-- it adds. Returns the request's id.
CREATE OR REPLACE FUNCTION public.gc_trade_ask_change(p_company_id uuid, p_package_id uuid, p_description text, p_reason text, p_amount numeric, p_days integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pkg record;
  v_sow public.gc_sows%ROWTYPE;
  v_text text := btrim(coalesce(p_description, ''));
  v_id uuid;
BEGIN
  SELECT k.id, k.project_id, k.ours, k.awarded_invite_id, g.stage INTO v_pkg
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No trade with that id.';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id;
  -- Signed is the status, never a row that merely exists; the award and the statement of work name the
  -- same ask, which gc_award writes together.
  IF v_pkg.stage = 'bidding' OR v_pkg.ours OR v_sow.id IS NULL OR v_sow.status <> 'signed'
    OR v_sow.company_id IS DISTINCT FROM p_company_id OR v_sow.invite_id IS DISTINCT FROM v_pkg.awarded_invite_id
  THEN
    RAISE EXCEPTION 'notAwarded' USING ERRCODE = 'P0001', DETAIL = 'A change is asked on work the company signed for, on a job that is ours.';
  END IF;
  IF v_text = '' THEN
    RAISE EXCEPTION 'descriptionNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say what changed.';
  END IF;
  IF char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep it under 2,000 characters.';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('owner', 'field', 'plans') THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'The reason is the customer, the field or the plans.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amountNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type what the company asks for the work.';
  END IF;
  IF p_days IS NULL OR p_days < 0 THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'The working days it adds are 0 or more.';
  END IF;
  INSERT INTO public.gc_trade_change_requests (project_id, package_id, company_id, sow_id, asked_on, description, reason, amount, days)
  VALUES (v_pkg.project_id, v_pkg.id, p_company_id, v_sow.id, public.app_today(), v_text, p_reason, p_amount, p_days)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_back_charge(uuid, numeric, text, text) IS 'GC mode (P4a): charge a trade on its signed statement of work (backCharge); the company is the one on it, the answer day five days on. Refuses anyone but a dev first (devOnly), then unsigned work (sowNotSigned), an amount not above zero and a blank reason. Returns the id. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_keep_back_charge(uuid, text) IS 'GC mode (P4a): keep a charge after a dispute, or when no answer came by its day (settleBackCharge, keep), with a note; never one taken off a draw. Dev only (devOnly). SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_drop_back_charge(uuid, text) IS 'GC mode (P4a): drop a charge not dropped yet and not taken off a draw (settleBackCharge, drop), with a note. Dev only (devOnly). SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_trade_answer_back_charge(uuid, uuid, boolean, text) IS 'GC mode (P4a): the company agrees to its charge or disputes it with a note (tradeAnswerBackCharge), while it is open and not taken, even after its answer day. Service role only.';
COMMENT ON FUNCTION public.gc_trade_ask_change(uuid, uuid, text, text, numeric, integer) IS 'GC mode (P4a): a change asked from the portal (tradeAskChange), only by the company on a signed statement of work on a job that is ours (portalCanAskChange), else notAwarded. Returns the id. Service role only.';

-- The office's three: signed-in users, and inside them a dev only, as above.
REVOKE ALL ON FUNCTION public.gc_back_charge(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_keep_back_charge(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_drop_back_charge(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_back_charge(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_keep_back_charge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_drop_back_charge(uuid, text) TO authenticated;

-- The trade's two, only the service role: the submit function, after it has turned a link into its company.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.gc_trade_answer_back_charge(uuid, uuid, boolean, text)',
    'public.gc_trade_ask_change(uuid, uuid, text, text, numeric, integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END;
$$;

-- Training mode and digital twins: the new tables get their blocks; the three create only what is missing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
```
