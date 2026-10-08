---
name: "GC mode, the Board: the real build plan"
parent: to-dos/gc-mode/README.md (punch list #81); BUILD_MAP.md section 3, Helper 2's row; PLAN_2026-10-07.md
status: written 2026-10-07 by Helper 2 at the lead's ask, for the lead's review and then the owner's. B1's columns are agreed with Helper 3 (Portal), and the seams with Helper 4 (Building) and Helper 5 (Owner Billing). Nothing is built and nothing touches the database until the lead says go.
summary: >
  How the Board moves from the prototype (made-up data on branch spike/gc-mode) into the real app.
  The company record comes first, because every other lane reads it. Then the Board's kernels, the
  board and one project on real data at /gc, asking companies through the Ask window, comparing and
  carrying quotes, and last award, the master agreement, the statement of work and Get started.
size: L (14 new tables, columns on 4 existing ones, 17 database functions, no edge function of its own, 10 PRs)
blocker: the lead's go, then the owner's word on the decisions below (each has a default)
---

# GC mode, the Board: the real build plan

## What moves, and what stays

The prototype proved these, and they move:

- **The company record.** A trade partner is a company, not a person. It has a main contact and the
  others it names, with the emails each one gets. It also has its trades, its address and how far
  it drives, its language, its vetting and its call log. The dates it gave us for papers and other
  things are part of it too.
- **Asking.** Who we asked on each trade and when, each ask's story (calls, texts, emails, nudges,
  what they said in their portal, the day they promised a quote), and why a company is out.
- **Quotes and our number.** A quote's lines, alternates, exclusions and its own schedule of values.
  The office's covers, plugs and taken alternates, what we carry, our number, bid sent, won, lost,
  and the bid tabs.
- **Award and the start.** Award with its gate, the master agreement, the statement of work, the
  papers, Get started and Start (with Start anyway).
- **The board.** The three stages and the strip, By customer, the rows, the price card, Who to call,
  Follow up, Trade partners (the bench, coverage, Actions for assistants, New to us) and the company
  window (About, Activity, Documents).

These stay with the lanes that own them, and this plan only points at them:

- **The trade's portal and every email** belong to the Portal lane (Helper 3, P1 to P5). The Board never
  sends: it calls P3's one email function with a kind (`invite`, `nudge`, `msa`, `sow`, `paper`).
  The trade's own writes are Helper 3's `gc_trade_<verb>` functions on the Board's tables, which I
  review.
- **The schedule** belongs to Helper 1. Its call list and counts (`gcCallList`, `gcCounts`) and the
  rest of `gcNotReady` wait on this lane's lift (B2), then go back to the schedule's PRs 14 and 16.
- **Building** (Helper 4) owns draws, draw lines, pay applications, sent-backs, punch, submittals,
  RFIs and the daily log. It also owns what a trade reports done (`gc_sow_line_reports`) and
  `closed_on`.
- **Owner Billing** (Helper 5) owns the customer's signed price: `owner_contract_signed_on`,
  `gc_owner_contract_lines` and `gc_sign_owner_contract`. B6's Get started calls that function and
  never writes those columns.
- **Back-charges and change requests** are the Portal's P4. Building links them to a draw.
- **New project** is done but for step 7, the set email. That step waits on B1 and P3.

## Decisions before the first migration

Each has a default the plan is written to. The owner changes any of them by saying so.

1. **Where a trade partner lives.** Main has no company record for the people we hire. A sub is a
   `people` row (`kind = 'sub'`) or a `users` row (role subcontractor), one person each.
   `supply_houses` is the vendor ledger: supply houses, insurers, rental yards, and "Outside
   Subcontractors" as one `sub_ledger` row. `customers` is who pays us.
   *Default:* a new table, `gc_companies`, with its people in `gc_company_people`. A company is not
   a customer: the owner's "one customer record" (2026-10-02) is for owners, architects and GCs we
   bid to. It is not a `people` row either, since BUILD_MAP says the record is keyed to a company,
   not a person. Main's GC tables already name it `company_id`, seven columns with no foreign key
   yet, and B1 gives them theirs.
2. **The main contact.** *Default:* on the company row (name, phone, email, the emails they get), and
   everyone else in `gc_company_people`. That is the prototype's `Partner` shape, so the mapper is a
   straight read (agreed with the Portal).
3. **Where they drive from.** *Default:* one `address` (where their crews leave from, and the address
   on their pay application, as in the prototype) and `max_miles`. There are no latitude or
   longitude columns: the points come from main's `address_geocodes` cache through `geocode-one`,
   the way the Bid Board's map reads them. The drive stays the prototype's straight line plus a fifth
   for the roads. Main's `driving-distance` function would give road miles, at a cost per company
   per project (call it later if the owner wants it).
4. **The counts behind reliability** (`invited`, `bids`, `won`, `promisesMade`, `promisesKept`).
   *Default:* derived from the asks, quotes, awards and promises, never stored. A company new to the
   app reads "not judged yet" until it has asks.
5. **Papers: master agreement, W-9, insurance.** Main keeps each sub's signed papers in
   `person_contract_documents`: `doc_type` agreement, w9 or coi, with status, `signed_at`, `expires_at`,
   form values, the last-four hints and the `/contract/accept` signing link. The Master Subcontract
   Agreement is the Contract Book's Subs-packet entry.
   *Default:* B6 adds `company_id` to `person_contract_documents`. A company's papers are those rows,
   so there is never a second paper system, and the mapper derives `msa`, `msaSignedOn`,
   `coiExpires` and `w9` from them. The cost is one column on a live table. Every reader of that
   table must ignore company rows (the check is in B6).
6. **The statement of work.** *Default:* on `step_commitments`, as the lead's brief and README's *Where it
   plugs in* say. B6 lets `person_id` be null when `company_id` is set, and adds `gc_package_id`
   as an anchor. The lifecycle (draft, offered, accepted, approved, settled), the amount, retainage,
   the offer and signer columns and the change requests are reused. GC's own part sits in a side
   table, `gc_sows`, keyed one to one to the commitment, with its lines in `gc_sow_lines`. That key was
   agreed with Building, whose draw lines point at `gc_sow_lines.id`. *The alternative:* `gc_sows`
   stands alone with the same statuses copied, which leaves `step_commitments` (a table the Subs tab
   uses all day) untouched.
7. **Quotes.** *Default:* append-only, so the newest quote on an ask counts and a resent one keeps
   the history ("What changed under a quote"). The office's own numbers (plugs, exclusion covers and
   taken alternates) sit on the ask, so a resent quote keeps them, and the portal never reads them.
   A quote's nested parts (its lines, alternates, schedule of values and exclusions) are `jsonb` in
   the `SubBid` shape, with a type check.
8. **Who sees and writes.** *Default:* dev only while it is built (`is_dev()` on every table), as New
   project and the schedule are. The board's door (Helper 6's door 2) swaps each policy to
   `public.gc_office_team()`, the one place door 1 names the GC office audience. Only where money is
   (`gc_project_money`, B5) does a policy keep a narrower predicate: dev, master and controller. The
   board opens to dev, master, controller, assistant and estimator. An assistant follows up the way an estimator does (question 9). Awarding
   stays with an estimator, a master or a dev. Our number and its fee stay with the owner and the
   controller.
9. **Sends.** *Default:* every email goes through the Portal's P3 function with a kind. The Board's
   windows show the email from P3's builder before it goes.

## The tables

Every migration starts with `SET lock_timeout = '3s';`. Each is numbered from `origin/main` and
claimed at the cut, written idempotent, and pushed by the lead only once it is on `main`. A migration
that creates a table ends with the three block calls. Every table gets RLS: dev only,
`FOR ALL TO authenticated USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()))`.
The trade's writes go through Helper 3's `SECURITY DEFINER` functions, granted to `service_role` only.
So no table here has a trigger or a check that needs `auth.uid()`, and every "by" column is nullable.
Each column names the prototype field it carries (`src/lib/gcMode/gcTypes.ts`).

### B1, the company record (day 1, one migration)

**`gc_companies`**, one row per trade partner company (`Partner`):

- `id`, `name` (`company`) and `trades text[]` (`trades`, GIN index).
- `contact_name`, `phone` and `email` (`contact`, `phone`, `email`).
- `contact_gets text[]` (`contactGets`: null means all four; a check holds it to quotes, job,
  contracts and pay).
- `address` (`address`: where they drive from, and their pay application's) and `max_miles`
  (`maxMiles`). `base` is read from the address.
- `license` (`license`), and `lang` (`lang`: `en` or `es`, default `en`, with a check).
- `portal_opened_on` (`portalOpenedOn`: the trade's Got it, written by the Portal).
- The vetting (`PartnerVetting`): `vetting_status` (null means a company we know, approved; else new,
  approved or declined), `vetting_limit`, `vetting_decided_on`, `vetting_decided_by` and
  `vetting_note`.
- `created_by` and `created_at`.

**`gc_company_people`** (`PartnerPerson`): `id`, `company_id`, `name`, `email`, `role`, `gets text[]`
(a check holds it to the four kinds), `added_by` (office or trade), `created_at` and `removed_at`. A
person taken off is kept, so Activity still says who got what. "Every kind goes to someone" is the
kernel `everyMailGroupCovered`, which both sides call. The trade's side also holds that rule in
SQL.

**`gc_company_vetting_forms`**, one to one (`PartnerVettingForm`): `company_id` (primary key),
`license`, `insurance`, `years_in_business`, `references`, `past_jobs` and `sent_on`. The Portal's P5
writes it.

**`gc_company_contacts`**, append-only, one table for both levels:

- Columns: `id`, `company_id`, `invite_id` (null for a note about the company), `on`, `by_user_id`,
  `by_name`, `how` (call, text, email, nudge, portal or note), `note` and `promised_by` (the quote
  day they gave).
- An ask's line is `AskContact`. A company line is `Partner.contacts`.
- `Invite.nudgedOn` is read from the newest office line, so a nudge is one insert.

**`gc_trade_promises`** (`TradePromise`): `id`, `company_id`, `kind` (the ten `PromiseKind`s, with a
check), `project_id`, `package_id`, `what`, `by`, `made_on`, `from` (office or trade) and `kept_on`.
**`gc_trade_promise_moves`** keeps each earlier day: `promise_id`, `by` and `moved_on` (`moved`).
These follow the same append-only shape as the Pipeline's payment promise events (v2.3280 to 3286):
a moved day is a new row and the old one stays.

**`gc_invites`**, one row per ask (`Invite`):

- `id`, `package_id`, `company_id`, `status` (invited, opened, bid or declined), `invited_on`,
  `invited_by` and `seen_rev`.
- The decline: `declined_why` (wont or cant), `decline_reason` (the six `DeclineReason`s),
  `decline_note` and `declined_on`.
- The office's numbers: `plugs jsonb` (a scope item id to an amount), `exclusion_covers jsonb` (an
  exclusion name to an amount) and `taken_alternates text[]`.
- Unique on (`package_id`, `company_id`). The tables are in B1 so the Portal's P1 reads real asks on
  day 2, while B4 keeps the window.

**`gc_quotes`**, append-only, the newest per ask counts (`SubBid`):

- `id`, `invite_id`, `amount`, `based_on_rev`, `submitted_on`, `includes jsonb`, `note` and
  `good_for_days`.
- `alternates jsonb`, `quote_file`, `sov jsonb`, `exclusions jsonb` and `exclusions_answered text[]`.
- `from` (office for one typed from an emailed quote, or trade).

**On `gc_projects`**, nullable dates the Board keeps:

- `our_bid_sent_on`, `permit_on` and `start_date`.
- `owner_contract_sent_on` (the send is the Board's; the signed date is Owner Billing's).
- `started_on`, `started_anyway_by`, `started_anyway_reason` and `started_anyway_missing text[]`.
- They ride in B1 so Building's daily log can read `started_on` from day 1 (Helper 4's ask).

**Foreign keys** to `gc_companies(id)` on main's seven loose columns:

- `gc_plan_questions.company_id` and `gc_plan_set_sends.company_id`.
- `gc_schedule_late_notices.company_id`, `gc_schedule_move_tells.company_id` and
  `gc_schedule_move_answers.company_id`.
- `gc_schedule_lookahead_marks.marked_by_company_id` and `gc_schedule_crew_counts.company_id`.
- Each is added `NOT VALID` and then validated. They are empty on prod, apart from the test question,
  whose company is null.

### B5, carrying, our number's money and the bid tabs (day 4)

- **`gc_project_money`**, our number's three inputs: `project_id` (primary key),
  `general_conditions`, `contingency_pct` and `fee_pct`. They leave `gc_projects`, because door 1
  opens `gc_projects` to the office and estimators. The owner's decision 2 (`NEW_PROJECT_REAL_BUILD.md`)
  keeps our number, fee and contingency to dev, master and controller. Its policy is the money
  predicate, never the office's. The move is expand, then contract:
  - B5's migration makes the table, copies the three values, and replaces `gc_create_project` so it
    writes there.
  - B5's client reads the table.
  - B6's migration drops the three columns once that client is live, so neither the old client
    nor the new one ever reads a column that is gone.
- **On `gc_trade_packages`**: `carried_kind` (invite, plug or self, with a check) and
  `carried_invite_id`, set only when the kind is invite (`carried`).
- **`gc_bid_tabs`** (`BidTab`): `package_id` (primary key), `shared_on`, `show_names` and `shared_by`.
- **`gc_bid_tab_views`**: `package_id`, `company_id` and `seen_on` (`seenBy`).

### B6, award, the statement of work and the papers (day 5 and after)

- **On `gc_trade_packages`**: `awarded_invite_id`, `awarded_by` (a user; `awardedBy`) and
  `awarded_on`.
- **Off `gc_projects`**: `general_conditions`, `contingency_pct` and `fee_pct`, dropped now that
  B5's client reads `gc_project_money`.
- **On `step_commitments`**: `person_id` may be null when `company_id` is set. It gains `company_id`
  and `gc_package_id`. The anchor check gains `gc_package_id`, and a dev policy is added beside the
  sub's own-row policies.
- **`gc_sows`** (`Sow`, GC's part):
  - `id`, `step_commitment_id` (unique) and `package_id` (unique).
  - `company_id`, `based_on_rev`, `sent_on`, `their_sov jsonb` and `excluded jsonb`.
  - Status, price, retainage, signed and the offer are the commitment's columns.
- **`gc_sow_lines`** (`SovLine`):
  - `id`, `sow_id`, `position`, `label` and `amount`.
  - `scope_item_id`, which is null only on a change order's line. That id is the line's id to the
    kernels, so the schedule's bars and Building's draws join on it (Helper 4).
  - `change_order_id`. A check says exactly one of the two is set.
- **On `person_contract_documents`**: `company_id`. The master agreement, the W-9 and the
  certificate are its rows.
- **`gc_paper_sends`** (`PaperSend`): `id`, `company_id`, `paper`, `project_id`, `package_id`, `on`,
  `by`, `note`, `first` and `draws int[]`.

## What the app already has, reused

- **The customer and the architect**: `customers`, read by the board's names and the company window.
  Nothing about `customers` changes.
- **The sub portal's pattern**: the link is the key, every read goes through a service-role function
  scoped to the link, every load is logged to `public_page_views`, and signing stores ESIGN consent
  (`docs/SUB_PORTAL_ARCHITECTURE.md`). The Portal lane builds the trade portal on it, one link per
  company (`gc_trade_portal_links`, P1). The Board adds nothing to the sub portal itself.
- **`step_commitments`**: the statement of work's lifecycle and signing (decision 6).
- **The Master Subcontract Agreement and the W-9**: the Contract Book's Subs packet and Contract
  Forms' W-9 template, signed through the existing `/contract/accept` link and kept in
  `person_contract_documents`. The certificate is a `coi` row with `expires_at` (decision 5).
- **The supply-house compare** (`bid_rfqs`, `bid_quotes`, `/q/<token>`): the pattern for one request
  to several companies, each answering by its own link, then one compare. GC asks follow it with one
  `gc_invites` row per company, answered through the company's portal link.
- **The map**: the `address_geocodes` cache (`geocode-one`, `useAddressGeocodeCoords`) and the Bid
  Board's map card (`BidBoardMapCard.tsx`, `bidBoardMap.ts`). The prototype's town list
  (`TOWNS`) stays on the spike.
- **Payment promise events**: the append-only shape that `gc_trade_promises` and its moves follow.
- **The company's day: `public.app_today()`** (`20260903190000`), the SQL twin of `todayYmdInAppTz()`.
  The database runs in UTC, so `CURRENT_DATE` is tomorrow every evening after 7 PM Central. Every
  date default and every function that stamps a day uses `public.app_today()`, never `CURRENT_DATE`.
  B1 used `CURRENT_DATE`, and `20261008120000` (#4951, v2.4918) fixed its six defaults and four
  functions. B5 and B6 use `public.app_today()` from the start.
- **Email**: P3's function on `sendEmailViaResend`, logged to `email_send_log`.
- **The read-only blocks, release notes, fragments, help guides and the plain-words test**: as every
  feature.

## Kernels that move over with their tests (B2)

The Board's kernels were traced function by function (each export's closure across the spike's
files, with what main already has counted as placed). **About 120 functions, roughly 2,600 lines,
read only the Board's own files and what main has**, so they move word for word under
`src/lib/gc/`. A test that reads only these kernels moves with them unchanged. Main gets a direct test
on the test data for each one over three lines that no moved test names. The equality script
(`lift-same.cjs`) shows each one equals the spike's.

| From | To | Moves |
|---|---|---|
| `gcBids` | `bids.ts` (main has 3 of it) | all 19, with `BIDS_WANTED`. `bidTabResult` reads `GC_COMPANY`, which main has in `company.ts`. `proposalTotals` goes with whichever of B2 and Owner Billing's O2b is cut first (agreed with Helper 5). |
| `gcFollowUp` | `followUp.ts` | all 6 |
| `gcReliability`, `gcBench`, `gcVetting` | `reliability.ts`, `bench.ts`, `vetting.ts` | all 2, 9 and 6 |
| `gcDecline`, `gcLost`, `gcStale` | `decline.ts`, `lost.ts`, `stale.ts` | all 7, 4 and 2 |
| `gcPromises` | `promises.ts` (main has `INSURANCE_ASK_DAYS`) | 11 of 13 |
| `gcMap` | `map.ts` | 6 of 7, by the one change below |
| `gcStart` | `start.ts` | `startChecklist` |
| `gcPriceStanding` | `priceStanding.ts` | all 4. It reads only Board kernels, and the board row needs it; asked of Helper 4, whose U2 listed it. |
| `gcPaperSend`, `gcCompanyFile` | `paperSend.ts`, `companyFile.ts` | 7 of 8, 4 of 8 |
| `gcBoardGroups`, `gcCustomers` | `boardGroups.ts`, `customers.ts` | 6 of 8, 1 of 4 |
| `gcPlans` (the pre-bid's) | `preBid.ts` | `preBidInvited`: who is asked to the pre-bid meeting, read from the asks. The Portal's pre-bid block reads it, and it is not New project's (Helper 6). |
| `gcAskCompanies` | `askCompanies.ts` | `askChoices` and `askStanding`, with the reducer's 7-line `find` placed in `lookups.ts` and the Portal's `mailRecipients`, `contactGets` and `PORTAL_MAIL_GROUPS` placed in `portal.ts` for P to extend |
| `gcCompanyPeople`, `gcProjectPeople` | `companyPeople.ts`, `projectPeople.ts` | `followItemMailGroup`, `mailToGreeting` and `companyPeople`; `customerAsPerson` |
| `gcNotReady` | `schedule/notReady.ts` (1b placed 3) | the other 8 |
| `gcCallList`, `gcCounts` | `schedule/callList.ts`, `schedule/counts.ts` | 5 of 8, and 8 of 16 |

**The one change on the way: the drive.** `driveMiles` finds both towns in the prototype's `TOWNS`
list. On main it measures between two points. `Partner` gains an optional `basePoint`, and
`GcProject` gains an optional `point`, each a `Town`. The real build's io fills them from the
geocode cache, and the spike's fixture fills them from `TOWNS`. `travelFor` reads the points, so
the golden test does not move. That is about 10 changed lines, and `lift-same.cjs` lists them as the
only difference.

**What waits, and for whom** (each moves in B2b, or with its lane):

- **The Portal's words** (P, the 895-line strings table): `mailGroupName`, `mailGroupList`,
  `mailToWhy` and `followUpMailTo`. `paperSendMessages` writes the papers' emails in the portal's
  words, so it moves with P3.
- **Building's U2**: `partnerWork` (retainage held), `partnerActivity` (`buildingActivity`) and
  `unconfirmedStarts`.
- **Owner Billing's O2** (the customer's signed price and their account): `ownerMoney`,
  `priceToOwner`, `customerSummary`, `customerGroups`, `boardSectionCounts`, `customerDocuments` and
  `customerPaper`. These move the day O2b lands, since Helper 5 cuts it on day 2.
- **All three plus the schedule's PR 9** (the people count, 1,400 to 2,000 lines each across four
  lanes):
  - From `gcProjectPeople`: `projectPeople`, `projectFollowPeople`, `allPeople` and
    `allFollowPeople`.
  - From `gcCallList`: `callList`, `callRows` and `callListFollowPeople`.
  - From `gcCounts`: `scheduleReasons`, `ourScheduleMoves`, `ourMoveLines`, `pastContract`,
    `gcScheduleMovesNeedsYou`, `barReasons` and `boardFollowPeople`.
  - `stageProgress` (the ring) and `stageHealth` (the strip under a project's title).
- **Never moves**:
  - `askDraft` plays the prototype's reducer to draw the invitation. B4 draws it from P3's builder
    instead.
  - `promisesKeptBy` and `keepPromisesOn` switch on the reducer's actions. On main there is no
    reducer, so each write that keeps a promise marks it kept in its own transaction through
    `gc_keep_promises` (B1, below). That covers Building's (Helper 4's decision 9) and the trade's
    verbs (Helper 3).

The kernels read the prototype's shapes. A mapper, `companyRows.ts` (B3), turns the rows into
`Partner`, `Invite`, `SubBid`, `AskContact` and `TradePromise`. It derives the counts (decision 4),
`nudgedOn`, and the papers once B6 lands. It gets its own test against rows built from the fixture's
Boerne companies, so no kernel changes when the data becomes real.

## Writing it: the database functions

All are `SECURITY INVOKER`, so RLS decides who may, as with `gc_create_project`. A single-table edit
is a plain write under RLS: a company's coverage, reach, language and people, a contact line, or a
Get started date.

**B1:**

- **`gc_add_company(company jsonb)`**: the company, its main contact and any people, in one
  transaction. It comes in not vetted unless *We have worked with them* is ticked (`addPartner`
  with `known`). It refuses a blank name or no trade.
- **`gc_vet_company(company_id, status, limit, note)`**: approved or declined, with the day and
  `auth.uid()` (`vetPartner`). It refuses a limit on a decline.
- **`gc_record_promise(...)`**: an open promise of the same kind, company and job moves, and its old
  day goes to `gc_trade_promise_moves`. Otherwise it is new. The same day twice changes nothing
  (`recordPromise`). **`gc_keep_promise(id)`** marks one kept (*It came*, `keepPromise`).
- **`gc_keep_promises(company_id, kind, project_id, package_id, on)`**: marks kept the open promise
  that matches, if there is one. It is the SQL form of `promisesKeptBy`. Building's writes call it
  in their own transaction (a log with the trade on site keeps `start`, the last submittal owed
  keeps `submittals`, and so on), and so do the Portal's trade verbs (a new certificate keeps
  `insurance`, a signed W-9 keeps `w9`).
- **`gc_invite_companies(package_id, company_ids uuid[])`**: one ask per company, skipping one
  already asked (`invite`). It refuses a lost project and a trade that is ours. It sends nothing:
  B4's window calls P3 after it.
- **`gc_office_decline(invite_id, why, reason, note)`**: the ask's decline, with will not or
  cannot, the reason and their words (`officeDecline`). It refuses `other` with no note. The
  prototype logs the decline to its own story only, so no contact line is written: the company's
  Activity reads it from the ask (`partnerDeclines`).

**B5:**

- **`gc_record_quote(invite_id, quote jsonb)`**: a quote typed from an email. It writes the quote
  row and sets the ask to bid.
- **`gc_set_quote_office(invite_id, kind, key, amount)`**: one plug, cover or taken alternate,
  merged into the ask without racing another edit (`setPlug`, `setExclusionCover`,
  `takeAlternate`).
- **`gc_carry(package_id, kind, invite_id)`** (`carry`).
- **`gc_mark_bid_sent`**, **`gc_mark_won`** (stage to buyout) and **`gc_mark_lost`** /
  **`gc_reopen_lost`**, on `gc_projects`' existing lost columns.
- **`gc_share_bid_tab(package_id, show_names)`**.

**B6:**

- **`gc_award(invite_id)`**: the award gate in SQL (vetting status and limit, as `awardGate` says
  it). It writes the award and drafts the statement of work from the quote (`sowFromBid`): the
  commitment, `gc_sows` and a line per scope item, in one transaction.
- **`gc_start_project(project_id, anyway jsonb)`**: refuses unless `startChecklist` has nothing
  missing or a reason is given (`startProject`, Start anyway).
- The trade's sign verbs (`gc_trade_sign_sow`; the master agreement through `/contract/accept`) are
  Helper 3's.
- *Owner contract signed* calls Owner Billing's `gc_sign_owner_contract`.

## The PRs, in order

Each ships alone behind the dev door, with its release note and docs fragment. From the first screen
on, each has a help guide in plain words. The version and the stamp are claimed at the cut, past
`main`'s newest and every claim not merged. Each is armed with `gh pr merge <n> --auto`, and I message
the lead when a migration waits. *Check* is how the reviewer sees it work.

1. **B1, the company record** (day 1, migration): the tables above, the project's dates, the seven
   foreign keys and B1's seven functions. No screen.
   *Check:* the migration doc's SQL shows each table empty with its policy. A training-mode user's
   insert is refused inside a transaction that never commits, and a twin's too. The seven
   foreign keys are listed. On prod, after the push, through the app's client as a dev:
   - `gc_add_company` makes "GC test trade company, delete me" with a second person who gets pay.
   - `gc_vet_company` approves it up to $50,000.
   - A promise moved once keeps its first day in the moves table.
   - `gc_invite_companies` on the test project's Concrete asks it once, and a second call adds
     nothing.
   - A read-only user's `gc_add_company` is refused.
2. **B2-i and B2-ii, the kernels lifted** (day 2, no database). It is cut in two:
   - **B2-i first**: what the Portal's P1 and the board row read. That is bids, follow-up,
     reliability, map, bench, vetting, decline, lost, stale, promises, paper sends, the pre-bid's
     invited list, the price card and the Ask window's choices. Helper 3's P1 lifts `portalAsks` and
     `portalHome` the hour these are on main.
   - **B2-ii**: start, not ready, the company file, board groups, customers, the company's people
     and the call list's and counts' share.
   *Check:* `npm test` passes and `lift-same.cjs` prints every moved declaration equal, with only
   the drive's lines changed. On the spike, after Helper 7's follow-up, the golden test passes
   without `-u` and `/bids/gc` behaves as before.
3. **B3-a, the board on real data** (day 2):
   - `/gc` becomes the Project Board: the strip and the sections (Bidding, Buying out, Building,
     Closed, Lost), By customer, rows with the days-left block, the name, customer and architect
     links, and the price line with its card.
   - `companyRows.ts` and the io read companies, asks and quotes.
   - The list of projects and their windows stay, as a project's own page.
   - Who to call and the ring wait for B2b. Until then a row's middle column is empty, not wrong.

   *Check:* the test project shows under Bidding with its days left, its five trades with "Nobody
   asked yet" on the price card, and its price "so far, with 5 holes".
4. **B3-b, Trade partners and the company window** (day 2):
   - **Add a company** (`gc_add_company`), coverage with the address checked against the geocode
     cache, language and people.
   - The bench by trade with the trade strip, New to us with Approve, Approve up to and Decline,
     and Actions for assistants.
   - The company window's About tab, with *Who gets our emails*.
   - Activity and Documents come as their kernels land.

   *Check:* the test company appears under Concrete. A second one added as new shows "not vetted
   yet" under New to us and is approved from there. Its drive from Boerne reads in miles.
5. **B4, asking through the company** (day 3):
   - The Ask window on real companies: `askChoices` and `askStanding`, the invitation drawn by P3's
     builder in the company's language, and **Ask N companies** calling `gc_invite_companies`, then
     P3's `invite`.
   - On the Trades tab, each ask's story: Log a contact, *They said by*, *Will not do it* and
     *Cannot do it* with why (`gc_office_decline`).
   - The map in the Bid Board's map card, in the lineup's order.
   - Follow up for quote asks. Work the list and the full count come with B2b.

   *Check:* asking the test company on the test project's Concrete makes one ask, and one email
   lands in an inbox the owner names (once P3 is in). Its story records a call with a promised
   day, and the price card reads "Waiting on an answer".
6. **B5, compare, carry, our number** (day 4, migration):
   - Compare quotes with its sentences, the exclusions table, covers, plugs and alternates.
   - **Carry**, Our number, **We sent our bid**, **We won this** and **We lost this**.
   - Our number's general conditions, contingency and fee move to `gc_project_money`, behind the
     money predicate, and `gc_create_project` writes there.
   - Bid tabs, shared and seen through the portal.

   *Check:* a training-mode estimator (after door 1) reads no row of `gc_project_money`. Then the
   prototype's Boerne compare, run on the test project. Two test companies quote
   Concrete through their portal links (P2), one leaves out a line, and covering it changes
   *Lowest, all in*. Carrying it fills Our number.
7. **B6-a, award and the statement of work** (day 5, migration):
   - Award with the gate and the estimator, and the statement of work drafted on
     `step_commitments` with `gc_sows` and its lines.
   - Sent to sign through P3. The trade signs in its portal (Helper 3's verb).
   - The contract-documents readers audited for company rows.
   - The three money columns dropped from `gc_projects`, B5's contract step.

   *Check:* award the test company on Concrete. A company not vetted is refused with the gate's
   words. The commitment reads offered, then accepted once signed in the portal. The Subs tab
   shows nothing new.
8. **B6-b, papers and Get started** (day 5 or 6):
   - The master agreement from the Contract Book sent and signed per company.
   - The W-9 and the certificate as company rows, and Send a paper with its days.
   - Get started's checklist, Start and Start anyway, and the Contracts tab.

   *Check:* the test company's master agreement goes out and is signed on `/contract/accept`.
   Get started reads every step, and Start on the test project sets `started_on` and tells the
   trades through P3.
9. **B2b, the people count and the ring** (once U2, O2 and the schedule's PR 9 are in):
   - The functions in *What waits*.
   - Who to call on each row, the ring and its card, *How the stage is going*, Follow up's Work
     the list, the dashboard's Needs you line, and the company window's Activity.

   *Check:* the counts match: the Follow up badge, Work the list and Needs you all equal the board
   rows' sum.

The door that opens the board to the office is Helper 6's (door 2), after B3 and B4.

## Docs each PR touches

- **Every PR**: one `src/content/releaseNotes/v2.NNNN.ts` and one `docs/recent-features/v2.NNNN.md`.
- **B1, B5, B6-a**:
  - `docs/migrations/<stamp>_<slug>.md` each, with the verify steps and their results in its
    *Status*.
  - `GLOSSARY.md` for trade partner company, ask, quote, carried, vetting, coverage, bid tab,
    statement of work and Start anyway, each in the PR that brings it.
- **B3-a**: `docs/twins/APP_DIRECTORY.md` (`/gc` becomes the board) and `PROJECT_DOCUMENTATION.md`.
  Guide: "see where every GC project stands".
- **B3-b**: guides "add a trade partner company" and "approve a company new to us".
- **B4**: guide "ask companies for a quote on a GC project".
- **B5**: guide "compare quotes and pick the one we carry".
- **B6-a**:
  - `docs/SUB_PORTAL_ARCHITECTURE.md` and `docs/RUN_SUBS_PLAN.md`: `step_commitments` rows keyed
    to a company.
  - Guide: "award a trade on a GC project".
- **B6-b**:
  - `docs/CONTRACT_FORMS.md`: papers keyed to a company.
  - Guide: "get a GC job ready to start".
- **The door** (Helper 6): `ACCESS_CONTROL.md`, with awarding kept to estimators, masters and devs.
- **The spike, after each lift merges**: the follow-up deletes what moved and re-exports it from main
  (Helper 7). This plan's *Status* records each PR.

## Who reads whose code

Other lanes call these or key to them. Change one only with the lanes that read it.

| What | Its shape | Read or called by |
|---|---|---|
| `gc_companies(id)` | Every reader's column is `company_id uuid REFERENCES gc_companies(id)`. | The Portal (its link table, every trade verb), Building (`gc_rfis.asked_by_company_id`, draws), the schedule (late notices, tells, answers, look-ahead marks, crew counts), New project (questions, set sends) |
| `gc_keep_promises` | `(p_company_id uuid, p_kind text, p_project_id uuid DEFAULT NULL, p_package_id uuid DEFAULT NULL, p_on date DEFAULT NULL) RETURNS uuid`: the promise kept, or null when none is open. It matches kind, company, job and trade exactly, null equal to null, as `openPromiseFor` does. `SECURITY INVOKER`, granted to `authenticated` and `service_role`. | Building's writes, inside their own transactions (a log with the trade on site keeps `start`, the last submittal owed `submittals`, a pay application resent `payApp`, the last punch item fixed `punch`, closeout papers in `closeout`); the Portal's trade verbs (`gc_trade_coi` keeps `insurance`, `gc_trade_w9` keeps `w9`, the sign verbs keep `msa` and `sow`) |
| `gc_record_promise` | `(p jsonb)`: `{companyId, kind, projectId?, packageId?, dueOn, source, what}`. It moves an open promise and keeps the old day. Granted to `service_role` too. | The Portal (a day the trade gives in its portal for a paper) |
| The promise kinds | The prototype's `PromiseKind` words verbatim: `insurance`, `w9`, `sow`, `start`, `submittals`, `delivery`, `payApp`, `punch`, `closeout`, `msa`. | Building, the Portal |
| `gc_invites`, `gc_quotes`, `gc_company_contacts` | An ask's line carries the ask's own company (a composite key). A quote day is `promised_by` on an ask's line. The quotes and the call log are append only for `authenticated`. | The Portal (P1 reads asks; P2 writes quotes, the quote day and declines through its own functions) |
| `gc_sows`, `gc_sow_lines` (B6) | `gc_sow_lines(id, sow_id, scope_item_id, change_order_id, …)`: `SovLine.id` is `scope_item_id`, except on a change order's line. | Building (draw lines, reports), the schedule (a bar's percent by line) |
| `gc_project_money` (B5) | Our number's three inputs, behind the money predicate. | Owner Billing, New project's `gc_create_project` |
| `theirSov.ts` (B6) | `SOV_STAGES`, `stageReached` / `StageReached` and `theirSovGap`, lifted from `gcTheirSov.ts` beside `gc_sows` and `gc_sow_lines`, since a quote's own schedule of values is copied onto the statement of work at award. | The Portal (`portalSovStart`, `portalSovCheck`, `portalSovReached`, which lift right after B6) |

## The owner's calls this plan raises

1. Trade partners are a record of their own (decision 1), not supply houses, not `people`, not
   customers.
2. A company's papers go on `person_contract_documents` (decision 5), and the statement of work on
   `step_commitments` (decision 6). Both add a column to a table the plumbing side uses every day.
3. The drive stays a straight line plus a fifth (decision 3). Road miles cost a call per company per
   project.
4. Reliability starts from nothing. A company the office has used for years reads "not judged yet"
   until it answers a few asks in the app (decision 4).
5. Who may vet a company: the prototype lets anyone on our team decide. The real build, at the door,
   could keep it to an estimator, a master or a dev, like award.

## Is this the best we can do?

It builds the gate first and lifts what can be lifted cleanly. It also puts the asks' tables in B1,
so the Portal is not waiting on the Board's screens. Three ways it could be better:

1. **Tie a company to its vendor record now.** When Building pays a draw, the money goes to a vendor
   the expense side knows (`supply_houses`, with `vendor_kind`). A nullable `supply_house_id` on
   `gc_companies` in B1 costs one column today. Leaving it out means matching names later, when
   bank lines start arriving. I would add it to B1 if the lead agrees.
2. **Land Who to call on day 2, not after three other lanes.** The people count could move by way 3,
   the schedule's trick. That means taking Building's, Owner Billing's and the schedule's reasons as
   one argument instead of reading their kernels, so B3-a shows the pill at once. The cost is
   changed lines in 14 functions, against the word-for-word rule. I kept the rule and left the pill
   to B2b.
3. **Bring in the companies the office already knows.** Typing forty trade partners one at a time is
   the slowest part of the first test. *Paste a list* on Trade partners could read company, contact,
   phone, email, trade and town from a spreadsheet, the way New project reads a sheet index. It could
   offer the `people` subs and `sub_ledger` vendors already in the app as a starting list. That
   would be a small B3-c with no migration.

## Status

Written 2026-10-07 by Helper 2 on branch `spike/board-plan`, cut from `origin/spike/gc-mode`, at the
lead's ask. Agreed the same evening:

- **With Helper 3 (Portal):** the table names, B1's columns, the asks' tables in B1, the trade's
  verbs as P's functions, sends through P3, papers on `person_contract_documents`, and one address
  with points from the geocode cache.
- **With Helper 4 (Building):**
  - `gc_companies(id)` and `company_id`, and `gc_sows` with `gc_sow_lines(id, scope_item_id)`.
  - Back-charges are P4's, and pct reported is Building's `gc_sow_line_reports`.
  - `started_on` rides in B1.
- **With Helper 5 (Owner Billing):** O1 owns the signed price and `gc_sign_owner_contract`, which
  B6 calls. `proposalTotals` lifts with whichever of B2 and O2b is cut first.
- **From the lead (door 1's review):** our number's money moves to `gc_project_money` in B5.
  Policies call `gc_office_team()` once the door opens, and a narrower predicate guards only the
  money. `preBidInvited` lifts in B2.
- **Later, with Helper 4:** Building's writes keep promises through B1's `gc_keep_promises`, and
  `priceStanding` lifts in B2 (Helper 4 agreed).

The lead approved the plan at its defaults on 2026-10-07 and merged it into `spike/gc-mode`. The
owner's calls go to him the same night, and none blocks B1.

**B1** is clickconstruction/pipetooling.github.io#4853: v2.4828, migration
`20261008020000_gc_company_record`, cut from main and armed on 2026-10-07. Before it was cut, all
seven `company_id` columns were empty or null on prod. The migration ran twice on a local Postgres
(PGlite) over main's GC tables. Beyond the plan, the call log, the quotes and the promise moves are
append only by privileges, and `anon` is revoked on every table (the schedule's PR 3 pattern).
Names that differ from this plan's first draft: the form's `reference_list` (`references` is
reserved), `contacted_on`, `due_on` and `source`. The lead pushes it first in the 2026-10-08 evening
batch, before Building's U1. B6's two live-table changes get their own review of every reader
before B6 is cut, and the standalone `gc_sows` alternative stays open until then.

**2026-10-08, day 2.**
- **B1** (#4853) is merged and applied, and verified in six steps (the migration doc's *Status*, docs PR #4878). Its types are in #4876.
- **B2-i** (#4862, v2.4845) is merged, with its spike follow-up (cf5edab1e).
- **B2-ii** (#4885, v2.4858) was rebuilt over U2 and O2a. Its eight lists are the latest config's list with B2-ii's fields after, so the generator writes main's test data byte for byte with LIFTS through `owner-billing-o2a` plus `--with board-b2-ii` (config on spike/board-b2-ii-config, 0d7a098f0). It is in the queue. One push from another checkout, a hand-merged `types.ts` and `testState.ts`, was dequeued and replaced.
- **The drive** reads a company's and a job's points when the app has them (b8c246d29), the towns standing in.
- **B3-a** is built and walked live as a dev on prod's test project, at a desk width and at 375 px. It opens when B2-ii merges.
  - `boardRows.ts` maps the company record, the asks, quotes, call log and promises to the kernels' shapes.
  - `GcBoard.tsx` draws the stages, the strip, the rows and a read-only price card, dev only above door 1's list.
  - The guide is `see-where-every-gc-project-stands`.
- **B3-a** (#4919, v2.4889) is merged as fd8188568.
  - P0 made `Invite.seenRev` required while it was queued. Another checkout's fix (94989a4e6) carries `gc_invites.seen_rev` through the mapper, and was checked and kept.
  - B3-a moved no kernel from the spike. `boardRows.ts` is main's own mapper, and the board's components are ports. So it has no lift config and no pin, and the spike keeps its board as it is.
- **B3-b** is clickconstruction/pipetooling.github.io#4928 (v2.4896), rebased onto main and armed. It is Trade partners, dev only behind a Project Board | Trade partners | Follow up switch on `/gc`.
  - The New to us box approves, approves up to an amount, or declines through `gc_vet_company`.
  - Each trade's card has its companies and the projects short of quotes. **Add a company** goes through `gc_add_company`, and the address and miles are a plain update.
  - The guides are `add-a-trade-partner` and `approve-a-company-new-to-us`.
  - The company window's About, with language and people, moves to **B3-c**, after #4857 lands the Portal's `contactGets`. B4 comes before it, at the lead's word.
- **B4-b** is clickconstruction/pipetooling.github.io#4931 (v2.4898), a draft on B3-b, to be armed once #4928 merges.
  - It adds Follow up for quote asks and each ask's story: Log a contact, and Will not do it / Cannot do it through `gc_office_decline` with the owner's six reasons.
  - Each project card also lists its asks under each trade.
- **B4-a's kernels** are clickconstruction/pipetooling.github.io#4939 (v2.4906), armed from main. They are `askChoices`, `askStanding` and `find`, lifted with `board-b4-a.lift.json`.
  - The spike keeps its own `askChoices` as the known difference, because the fixture's companies with no email need their made-up address.
  - The window waits for #4928 on main and for the Portal's `inviteMessage` (P1b-i).
- **Test rows on prod (rule 5), kept for P1b's link mint and B4's Ask check, swept at call 13:**
  - `gc_companies` `ff11d0fb-269e-44de-b92a-e7256c180f67`, "GC test trade company, delete me". It does Concrete, its contact is "Test contact" at gc-test-trade@example.com, and it drives from 200 Main St, Boerne, up to 50 miles.
  - It was added through B3-b's Add a company as a dev on 2026-10-08. It was approved up to $50,000 with a note, then its miles were changed from 60 to 50. Each step was read back from the table.
- **Left for B2b:** the call list and counts, a customer's activity, documents and money, and By customer.
- **Moved to B5:** `gcStale`.
- **Moved to B6:** `gcTheirSov`, at the Portal's ask.

