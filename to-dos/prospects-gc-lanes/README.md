---
name: "Prospects: finding jobs to GC and subs for the bench, beside the customers"
number: 110
group: close
status: built 2026-10-15 to the revised cut in four PRs: v2.5559 (#5753, migration 20261015040000 pushed 21:51 UTC), v2.5560 (#5755), v2.5561 (#5760), v2.5563 (#5765); walked live on prod data with made-up rows, all deleted
summary: >
  Prospects is the company's one finding page, and it finds only customers (a GC or an owner who
  could send us plans for our trades) and hires. GC mode now needs two more kinds found: owners,
  developers and architects with jobs we could build as the GC, and trade companies for the bench.
  Both destinations exist and both start after the finding is done (the bench says "Concrete has
  1. Find 2 more" with nowhere to look; the GC Customers tab starts at Asked us). The revised cut
  gives Prospects four top tabs (Customers · Jobs to GC · Subs · Hiring), one kind on the prospect,
  and the same deck for each, with each lane's own facts (trades, range and language on a sub; a
  jobs list with bid days on a GC lead), its own last press (Add to the bench ✓ fills the bench's
  Add a company; Asked us ✓ makes the customer and opens New project filled in), the bench's needs
  heading the Subs lane, a double caught while typing, sources with success, and doors back from
  the bench's gap and the Lost lane.
next: >
  The owner uses the three lanes for a week and changes any call under Where it stands, each built
  to the mock-up's default. Then the two residuals if the owner wants them (a sub's and an owner's email
  words; Add to Prospects from a lead's thread), or retire this folder.
size: S · S
blocker: The owner's look.
---

# Prospects: finding jobs to GC and subs for the bench

## Where it stands

**Built 2026-10-15**, on the owner's "build it" for the revised cut, in four PRs, each rebased onto `main` after the one before merged:

| PR | Version | What it did |
|---|---|---|
| #5753 | v2.5559 | The kind on `prospects` (migration `20261015040000_prospect_kinds.sql`: `kind`, `source`, a sub's trades, range and language, a lead's role and customer link, the two conversion links, `prospect_jobs`), the four top tabs, New Prospect's kind cards and each kind's boxes, the per-kind last press (Add to the bench ✓ opens the bench's Add a company filled in), the list and Activity per lane. |
| #5755 | v2.5560 | Subs: What the bench needs (the bench's rule of three, a chip a trade, counting the lane as it stands), By need, the call script on the card, the bench's trade names as picks, the double against the bench, Source success, and Find on Prospects → on the bench's "Find N more". |
| #5760 | v2.5561 | Jobs to GC: the Jobs box (+ Add a job, Lost with who won, Drop, Reopen, Remove), Soonest bid, GC work in flight, Asked us ✓ handing the soonest job to New project filled in, Link this lead to a customer it already is, and Send the owner back to Prospects on a lost GC project's card. |
| #5765 | v2.5563 | Every other reader keeps to its kind: Quickfill's counts and Can't reach list, Add customer's prospect search, Activity's 30 days, and a link that names a prospect of another kind opens its own lane. |

**The owner's seven calls, as built** (each the mock-up's default; say so to change one):

1. **Tab names**: Jobs to GC and Subs.
2. **Who sees the lanes**: the one Prospects gate (dev, master, assistant, controller, an estimator with the flag).
3. **Asked us ✓**: makes the customer (or uses the linked one), marks the soonest job asked, and opens New project filled in. Nothing is made on GC projects until New project's own Save.
4. **The jobs list**: shipped from day one.
5. **Lost owners**: back to Prospects by a press on the lost card, never on their own.
6. **By need**: shipped beside Coldest and Never called.
7. **Trade names**: typed, with the bench's own names offered as picks, since the strip counts by the bench's spelling.

**Walked live 2026-10-15** on the dev server against prod, as a dev, with made-up rows, all deleted after. The customer deck read as before: 268 in the queue, the same first card, Converted ✓ and the copy row. On Subs a test sub showed its chips and facts, and the strip went from 0 to 1 to call and back to 0 on delete. By need and the call script showed, and Add to the bench ✓ opened Add a company filled in (cancelled, not saved). The double warning named the GC test trade company, a link with no lane opened the sub on Subs, Activity read Source success, and Quickfill held at the customer deck's 268. On Jobs to GC a lead typed as the GC test customer's name offered and took the link. The Jobs box added, lost, reopened, dropped and removed jobs, and Asked us ✓ opened New project filled with the job and the customer (cancelled), the job reading asked us. The walk found two faults, both fixed before their PRs merged: the strip kept counting a deleted sub (v2.5560's `stillQueued`), and an asked job claimed a GC project held it before any did (v2.5561's words).

**Not run live**: a saved Add to the bench (no screen removes a company from the bench, so a test company would stay on it and count toward a real trade), Send the owner back to Prospects (no lost GC project on prod), and Asked us ✓ through Add customer (it would make a customer). Each is covered by its kernel and render tests.

**Residuals**, each waiting on the owner:

- **A sub's and an owner's email words.** The customer deck's three templates are written to win plumbing customers, so they show on Customers only. Templates per lane need the company's words for each audience.
- **Add to Prospects from a lead's thread.** Messages draws no lead card yet (R8 · 9 has been kernel-only since v2.5416, with its own calls on leads' home and who reads a lead's prospect). `prospectRowFor` takes the lane since v2.5563, so the press is one small PR once the card exists.

## The ask

The owner, 2026-10-15: "Right now we use prospects to find General Contractors for our trades to
bid, but now that we have the option to be a GC thanks to Bids, GC mode, I think we should also add
tabs for finding Jobs that we could GC and finding Subs (another form of a trade partner) to fill
our jobs. Can you look deeply at this and help me come up with a plan and mockup of what it could
look like? After your first mockup ask yourself is this the best we can do? are we making things
intuitive and robust? and then present me the revised mockup."

## What exists today

- **Prospects** (`src/pages/Prospects.tsx`, map `docs/PROSPECTS_TABS_ARCHITECTURE.md`): two top
  tabs, Customers (Follow Up · Prospect List · Convert · Activity) and Hiring. The deck's machine is
  the asset: the queue and its two orders (`callingOrder.ts`), the 30-minute calling lock
  (`callingLock.ts`), the five outcomes, warmth, callbacks, timers, copy templates, quick notes,
  the week report (`prospectWeekReport.ts`). `prospects` has no kind column; a conversion writes
  `prospect_fit_status = 'converted'` and names the customer in a comment's text, no FK
  (`prospectConversion.ts`).
- **The bench** (GC projects → Trade partners, `src/components/gc/GcTradePartners.tsx`):
  `gc_companies` (name, contact, phone, email, address, `trades[]`, `max_miles`, `lang`, vetting
  new · approved · declined), the rule of three per trade (`src/lib/gc/bench.ts`, `BENCH_WANTED`),
  "Concrete has 1. Find 2 more." with Add a company as the only intake (`gc_add_company`), and the
  call script of v2.5556 (`src/lib/gc/callScript.ts`, `GcCallScriptWindow.tsx`,
  `/gc?view=partners&script=1`). Nothing lists companies to call.
- **A GC project** (`projects` + `gc_projects`): the customer's role (owner · gc · ownersRep,
  `src/lib/gc/customerRole.ts`), the architect as a customer, bid due, sq ft; made by New project
  (`gc_create_project`, draft shape `src/lib/gc/newProjectDraft.ts`). The GC Customers tab's first
  step is **Asked us**; the Project Board's first lane is Bidding to the customer; Lost keeps the
  record. Nothing holds a lead before the ask.
- **Messages** knows the kinds already (`src/lib/contacts/names.ts`: customer, trade partner,
  architect, lead, supply house, candidate, sub, teammate). Add to Prospects
  (`src/lib/prospects/leadThread.ts`, v2.5416) writes a customer prospect and is kernel-only today.
- **Bids** carry ITB links labelled PlanHub · BuildingConnected · Procore (`src/lib/itbLinks.ts`);
  there is no lead feed.

## The decision

`mockup.html` draws today (0), the first cut (A) and the revised cut (B), with the critique between
them and the owner's calls at the foot.
The same page as a canvas: *Prospects finding lanes* — https://claude.ai/artifact/WeeiguaGTCQKkSKvyatUG9

- **A**: four top tabs, Customers · Jobs to GC · Subs · Hiring, each new tab with the same four
  sub-tabs; a kind picker on New Prospect; what makes a sub a sub in the notes; Converted ✓ opens
  Add customer for every kind. The honest minimum, one column under it all.
- **The critique** found eleven weak spots: sixteen screens from four by four; a job as a sentence
  (an owner has several, and the bid day orders the queue); the bench's need on another page;
  Converted ✓ meaning nothing on a sub and opening the wrong record; trades and range unfilterable
  as notes; nothing catching a double; the call script a page away; no source; a conversion with no
  FK; a texting lead with no kind; lost owners going cold.
- **B** keeps A's shape and fixes each: the new lanes get Follow Up and List only (Activity is one
  report with kind chips; Convert stays Customers only); a GC lead carries a jobs list and a
  Soonest bid order; a What the bench needs strip heads Subs, each trade a filter with its queue
  count, and the bench's "Find 2 more" opens it; Add to the bench ✓ fills the bench's Add a company
  (vetting new); Asked us ✓ makes the customer and opens New project filled in; trades, range and
  language on the sub's card and list; a double against `gc_companies` and `customers` caught while
  typing, and a GC lead may link to an existing customer; the call script on the card; a source on
  every new-kind card with Source success on Activity; `converted_customer_id` and
  `converted_gc_company_id`; Add to Prospects offers the kind; Send the owner back to Prospects on a
  lost project.
- **Said no to**: a Finding fold on the GC pages (two decks drift; the caller works one page); a
  kind filter instead of tabs (one kind at a time, its own script and last press); one card per job
  (the person called is the owner; two jobs collide on the contact and the lock).

The owner's calls, at the mock-up's foot: the tab names; who sees the lanes; what Asked us ✓ does
(customer and project, or customer only); the jobs list in PR 3 or notes for a month; lost owners
back by a press or automatically; By need on the Subs queue; the trade names as the bench's list
with free typing or a fixed list.

## Where it plugs in

- `prospects`: new columns `kind` (`customer` default · `gc_lead` · `sub`), `source`,
  `trades text[]`, `max_miles`, `lang`, `company_role` (owner · developer · architect · ownersRep ·
  gc), `customer_id` (a lead linked to an existing customer), `converted_customer_id`,
  `converted_gc_company_id`. One new table `prospect_jobs` (prospect_id, name, address, sq_ft,
  size_note, plans_link, bid_due, status open · asked · lost · dropped, won_by). Both migrations
  idempotent, `SET lock_timeout`, the three fence appliers on the new table.
- `src/pages/Prospects.tsx`: the top-tab row and `?tab=` keys (`gc-leads`, `subs`), the kind
  through `loadFollowUpProspects` / `loadProspectListProspects`, the outcome row's last press per
  kind, the New Prospect modal's kind cards and per-kind fields, the strips. The landing kernel
  `prospectsLanding.ts` learns the two keys.
- Kernels: `callingOrder.ts` gains `by-need` (subs) and `soonest-bid` (GC leads);
  `prospectConversion.ts` gains `benchDraftFromProspect` (→ `gc_add_company`'s shape) and
  `newProjectDraftFromProspect` (→ `newProjectDraft.ts`'s shape) and marks each with its FK;
  `prospectListGrouping.ts` takes the kind (the terminal sections read On the bench · Asked us);
  `prospectWeekReport.ts` takes the kind; a new `prospectDoubles.ts` matches a name or phone
  against `gc_companies` and `customers`; `leadThread.ts` takes a kind (default customer).
- The bench: `src/lib/gc/bench.ts` `tradeBenches` feeds the What the bench needs strip (and the
  per-trade queue counts come from `prospects` where `kind = 'sub'` and `trades @> …`);
  `GcTradePartners.tsx`'s "Find N more" gains the door `/prospects?tab=subs&trade=<name>`; the
  Add a company window (`GcTradePartners.tsx`) takes an initial draft; `GcCallScriptWindow.tsx`
  opens from the sub's card with the prospect as the company.
- GC projects: the New project window takes a draft from the lead's job; the Lost lane's card gains
  Send the owner back to Prospects (writes a `gc_lead` prospect with the job `lost`).
- Messages: the sort card's Add to Prospects (still to be wired on screen, v2.5416 is kernel-only)
  offers the kind.
- Guides: `find-subs-for-the-bench`, `find-jobs-to-build-as-the-gc` (new), and amendments to
  `work-the-prospect-calling-queue`, `add-a-trade-partner`, `start-a-gc-project`. Docs: the
  Prospects map, the page map's §17 and the `/gc` section, the Glossary (a Prospects entry of its
  own: the Glossary has none for the customer deck today), ACCESS_CONTROL for the new columns and
  table, APP_DIRECTORY.

## The plan, once the calls are in

Four PRs, each shippable alone, each cut from fresh `main`:

1. **The kind** (M): migration (`kind`, `source`, the two converted FKs); the two top tabs behind
   the Prospects gate; New Prospect's kind cards; Follow Up and List filtered by kind; the last
   press named per kind (Add to the bench ✓ opens the bench's Add a company filled from the
   company fields; Asked us ✓ opens Add customer with the role, as today's Converted does);
   Activity's kind chips. The two new guides.
2. **Subs** (M): `trades`, `max_miles`, `lang` on the prospect and the card; the trade chips in
   New Prospect from the bench's names; the What the bench needs strip and the per-trade filter;
   By need; the call script on the card; the double against `gc_companies`; "Find N more" on the
   bench links in; Source success per kind.
3. **Jobs to GC** (M–L): `company_role`, `customer_id`, `prospect_jobs` and its migration; the jobs
   list on the card with Add a job; Soonest bid; Asked us ✓ makes the customer and opens New
   project filled from the chosen job; the double against `customers` with Link instead; the GC
   work in flight strip; Send the owner back to Prospects on Lost.
4. **The lead's kind and the templates** (S): Add to Prospects offers the kind (and the press is
   put on screen); copy templates per kind; the Glossary entry for Prospects.

Each PR: kernels and tests first, a render smoke on the words that moved, a release note, a
fragment, the Prospects map and the page map amended.

## How to verify

Live, as a dev on `/prospects`, with made-up rows named `ZZ Test …` (a sub "ZZ Test Sprinkler Co"
with two trades and a range; a GC lead "ZZ Test Owner Holdings" with two jobs, one due next week):
the queue orders, the lock from a second tab, each outcome, Add to the bench ✓ landing the company
under its trade on `/gc?view=partners` with vetting new, Asked us ✓ landing a customer and a
bidding project on the Project Board, the double warning when the same name is typed again, the
Lost card's door, and Activity's chips. Then delete the ZZ rows, the test company and the test
project (the existing "GC test …, delete me" rows are the pattern). As an assistant through
imitate (localhost): the lanes show; as an estimator without the flag: they do not.
