---
name: "Permits: a Market page — who builds, and who to call"
number: 405
group: ready
status: Go 2026-11-19 · steps one and two built, v2.7978, v2.7982 and v2.7993 (the page's five parts) · the owner answered the four calls 2026-11-20 · step three is go in its smallest form · the owner makes the calls
summary: >
  The only way into commercial work today is to ask a company to let us bid. A Market view on
  Prospects → Permits says which companies to ask, why now and who to ask for, and whether the
  companies we already bid actually build. It leads with a call list of five names a week, then a
  table of every company we priced for beside the permits it pulled, then a clock (how long from
  the day the city first shows a job), who holds the work where a city names the plumber, and how
  much is being built. Each row gives its reasons as tags and there is no score.
next: >
  Build the owner's four answers of 2026-11-20: the call list's order and its count, the rule for
  a name that comes back, Austin's name mark, and step three for the next 25 San Antonio companies.
size: L as a train of three (M · M · L)
blocker: None. Step three starts with its drawing, which the owner sees before it is built.
opinion: build — start with step one, which needs no research and is the table that says where estimating hours go
---

# Permits: a Market page — who builds, and who to call

Mock-up: [`mockup.html`](./mockup.html). Every company, person, address and number on it is made up.

## For whoever builds this

Read this card top to bottom, then the mock-up. Everything decided is here.

- **What is asked:** build the page in the mock-up, in the steps under [The train](#the-train-step-by-step), and show it to the owner on live data.
- **When:** the owner wants to see it the day after 2026-11-19. Steps one and two are the target. Say plainly what was not reached.
- **What is settled:** the page's five parts and their order, five names a week, no score, the owner makes the calls. Do not reopen these.
- **What is not:** step three. Bring the owner its one question.
- **What to bring to the showing:** see [What to show the owner](#what-to-show-the-owner).

## The ask

The owner, 2026-11-19, after the permit fixes of that day ([v2.7922](../../docs/recent-features/v2.7922.md), [v2.7935](../../docs/recent-features/v2.7935.md), [v2.7966](../../docs/recent-features/v2.7966.md)) and a trial that looked up twenty San Antonio builders:

> *"Knowledge really is power, so will you be able to help me think of what a page could look like that shows useful insights as to things that we can use to make great decisions and track down great companies. Right now our only real method for commercial work is to contact a company and ask them to let us bid their work."*

Asked who would own the calls the page produces, he answered: *"I would."* Then: *"I would like to add all of the steps and our plan and the mock-up to a punch list card … so I can have someone else build it. And they can present it to me tomorrow."*

## What a first read of the data found

Read on 2026-11-19 through the app's own reads, signed in, writing nothing. The counts were given to the owner and are not kept in this public folder. [How each number is counted](#how-each-number-is-counted) says how to read them again.

- **The companies we bid and the names on the permits barely overlap.** The match is by exact name, so the real overlap is larger. It is still the finding to explain, and the reason the bid table sits second on the page.
- **Hundreds of names pull three or more commercial permits a year in San Antonio.** We have a bid on record with a handful of them.
- **A San Antonio application comes weeks before its permit.** That is the window to call in.
- **In Austin the plumber's permit lands within days of the building permit.** By the time the feed shows the job it is taken. Austin is read for who builds, not for the job.
- **In Austin a few plumbers hold a large share of the named jobs**, and some builders use a different plumber on every job. Those builders are the open doors.
- **No builder carries a mark or a kind yet.** The page starts without the office's own judgement.

## The page

A view on Prospects → Permits, beside Builders. In order:

1. **Call this week.** Five builders, ranked, each with its reasons as tags (*Picking up*, *New and busy*, *Never bid*, *3 jobs open now*, *We bid 4, won 0*), the jobs it has applied for with no plumber yet, and who to ask for. **Pursue** makes the lead the skim's Pursue makes. A name leaves the list when it is answered, and the next takes its place.
2. **Do the companies we bid build here?** Every company we priced for in two years beside the permits it pulled. *Builds, and we win* · *Builds, we never win* · *No permit on record*, which offers **Tie a name**, since a company may file under a person or an expediter.
3. **The clock.** San Antonio: application to permit. Austin: building permit to the plumber's permit.
4. **Who holds the work.** The plumbers on the permits, and how tied each builder is to one. Drawn only where the city's permits name a plumber (`cityNamesPlumbers`).
5. **How much is being built**, what kind and how big.

Four tiles sit above them: builders to call this week, their jobs applied for with no plumber, companies we bid that pulled a permit here, and the weeks from an application to its permit.

## The train, step by step

One change a PR, as [CLAUDE.md](../../CLAUDE.md) has it. Kernels first, each with its tests. Every PR carries its release note, its fragment and the guide's lines.

### Step one: the bid table and the clock

**Built, v2.7978** ([fragment](../../docs/recent-features/v2.7978.md), which says where the build differs from this plan and why). No migration.

Needs no research. San Antonio first; the other cities follow the same code.

- **The view.** Add `market` to the tab's views (`ProspectsResearchTab.tsx`, the `view` state) and to the strip, beside Builders. Let the address open it (`permitsLink.ts`, which already carries `view` for Builders). A new `PermitMarket.tsx` draws it.
- **The bid table.** Try it with no migration first. `loadBuilders(city)` already returns every permit name with its permits, and `builderAnswers.ts` over `builderAnswersIo.ts` already reads the customers, our bids with them and the names a person tied to a customer. A kernel (`src/lib/research/permitMarket.ts`) turns that around: one row a company we bid, with its bids, its wins, the permits its names pulled, and what it reads as. **Tie a name** is the door Builders already has.
- **The clock.** A kernel over the permit rows the tab already holds: the quartiles of the days between two dates. Words for the two notes under it.
- **Tiles.** The two that need no call list: companies we bid that pulled a permit, and the weeks from application to permit.
- **A migration only if a read is too heavy.** San Antonio holds over sixty thousand permit rows. If the page needs a read the client cannot do in one or two requests, write a function, and merge that migration in a PR of its own before the client that calls it.
- **Done when:** the table lists every company we bid in two years with the three columns and its tag; the three chips filter it; the clock draws for San Antonio and Austin; the numbers match [the definitions](#how-each-number-is-counted) on a hand count of five rows.

### Step two: the call list

**Built, v2.7982** (the answers table) **and v2.7993** ([fragment](../../docs/recent-features/v2.7993.md), which says where the build differs from this plan and why). The order has one more key than the one proposed below: a name that reads as a builder comes first. Since [v2.8112](../../docs/recent-features/v2.8112.md), on the owner's answers of 2026-11-20, a name with a building word leads, a job is counted once on the list, and an answered name comes back only with a new job.

- **The rows.** Builders with three or more commercial permits in twelve months, never a name marked *Avoid* or said to file for others. Each carries its tags, its jobs applied for with no plumber, and our history with it.
- **The order.** Proposed, and the builder's to refine before the showing: a job open now first, then picking up or new and busy, then never bid, then the most permits in ninety days. Five show. The reasons are the tags; no number is shown as a score.
- **The filter chips** over the list, each with its count: *This week*, *Has a job open now*, *Picking up*, *New and busy*, *Never bid*, *Jobs over $1M*.
- **Pursue and Not for us.** Pursue makes the lead the skim makes (`approachFromPermit`). An answer takes the name off the list. That needs somewhere to keep the answer and a day to look again: a small table of its own, written by the one who answers, read through `user_can_research_permits()`. A table means a migration with the four fences, in a PR of its own, pushed before the client.
- **Who holds the work**, where the city names plumbers: the plumbers by jobs, and of builders with three or more named jobs, how many use one, lean to one or shop around.
- **How much is being built:** permits a month, by kind, and the value bands.
- **Ask for** is drawn as an empty state until step three: *Nobody looked this name up yet*, with the Google press the skim card already has.
- **Done when:** five names show with true reasons; answering one brings the next; the list is the same on a reload; a builder marked *Avoid* never shows.

### Step three: Ask for — go in its smallest form, 2026-11-20

A one-time lookup of each name: the company, what it is (builder, owner, architect, a filer for others), a phone, a person and title to ask for, each with the page it came from, the day, and whether a person checked it.

- **The question for the owner:** may an agent look up the top names of a city once? About 150 names a city, a minute each, public sources only, nobody contacted, nothing shown as checked until a person checks it.
- **His answer:** yes, smaller. See [The owner's answers](#the-owners-answers-2026-11-20).
- **What the trial showed:** a builder worth a call behind about half of twenty names. The largest filers were not builders. Two of the agents' inferences were wrong and were caught on a check, so the person's check is part of the design.
- **Not designed here:** where the facts are kept and how the lookups are run. That is the first thing to draw if he says yes.

### After the list exists: the Monday note

The top block, five names with their reasons, sent to the owner on Monday morning. The Report Subscriptions pattern ([`docs/REPORT_SUBSCRIPTIONS.md`](../../docs/REPORT_SUBSCRIPTIONS.md)) is the way to send it.

## How each number is counted

So the built page and the first read agree, and so a hand count can check it.

- **A commercial permit:** a row of `permits` with `kind = 'building'` and not residential. Its day is the issued day, else the submitted day. *Twelve months* is that day within 365 days of today.
- **A builder:** a commercial permit's `builder_key`. San Marcos and Seguin publish no applicant, so they have none.
- **A job, on the call list:** one name's commercial permits of one day at one address, counted once (`marketJobs`, v2.8112). An application and its permit are one job, and so are the buildings of one project. The call list counts jobs. Builders, the table of companies and *How much is being built* still count permits.
- **A company we bid:** every bid made in the last two years, under its customer's name and its GC's name, keyed the way permits are (`research_name_key`). A win is an outcome of won or started. Leave out the catch-all customers a bid portal's bids sit under, and the robot's practice bids. The first read did not leave those out, so the built count will be a little lower. Say so at the showing.
- **The permits it pulled:** commercial permits in twelve months, in all five cities, under that key or under a name a person tied to the customer.
- **Picking up:** two or more permits more in the last 90 days than in the 90 before. **New and busy:** three or more in the last 90 days and none in the 90 before. **Slowing:** three or more in the earlier 90 and two or more fewer now.
- **Open now:** an application with no plumbing permit tied to it (`plumbingOnFile` is false) and no answer that closes it.
- **The clock, San Antonio:** applications submitted in twelve months that carry an issued day. The days between the two. The page shows the quarter marks and the middle.
- **The clock, Austin:** building permits with a plumbing permit that counts. The days from the building permit's day to the first such plumbing permit.
- **A named plumber:** a plumbing permit that counts for the job and lists someone other than the applicant, as `research_builders` names one. A builder is judged on three or more named jobs: one plumber on three in four of them *uses one*, on half *leans*, on fewer *shops around*.
- **How big:** among permits that carry a value, those at $250k or more and at $1M or more.

## What each part stands on

| Part | Reads | How solid today |
|---|---|---|
| Busy, picking up, new | Building permits by name, the last 90 days against the 90 before | Solid in San Antonio, whose records start in January 2025. Three months old in the other four cities. |
| Open now | An application with no plumbing permit tied to it (`permit_address_plumbing_counts`) | Solid in San Antonio since v2.7922. Austin's feed has no applications. |
| Do the companies we bid build | Our bids' customers and GCs matched to permit names | Weak until names are tied: the match is exact, and San Antonio's applicant is often a filer. |
| Ask for | A one-time lookup of each name, kept on the builder | Not built. Step three. |
| The clock | The days between the dates on the permits | Solid. |
| Who holds the work | The name on a plumbing permit at the job's address | Austin and New Braunfels only, and thin after three months. |
| How big | The value and the square feet on the permit | Most San Antonio permits have a value. Austin's values look unreliable: too many are one round figure, so show Austin no value bands. |
| Good, Avoid, the kind of company | The office's marks | Empty until they are said. |

## What bites here

- **San Antonio's applicant is often not the builder.** The largest filers are permit coordinators, engineers and architects. A name said to file for others (the builder's kind) stays off the call list.
- **San Antonio never names the plumber.** A job's plumbing permit rides the job's own number under the applicant's name. Draw nothing about plumbers there.
- **A plumbing permit counts for a job by one rule**, `permit_address_plumbing_counts`. Read through the functions that call it; do not pair permits by address in new code.
- **Austin has no applications**, only issued permits, and its records start in late August 2026.
- **The to-do pages and this repo are public.** No real company, person, address or count in a mock-up, a card, a test or a PR. The counts are the owner's.
- **A migration merges alone, before the client that calls it**, and is pushed from a checkout of main. Every new function is closed to anon by name.
- **The preview reads the live database.** Check read-only. Press nothing that writes on a real row.
- **The guide ships with it:** a section in `src/content/help/research-permits-for-work-to-bid.md`, in plain words.

## How to check it

1. `npm test` for the kernels and the render tests.
2. The dev preview, signed in, on Prospects → Permits → Market, San Antonio. Count the requests after it opens: a view that reads in a loop does not show in a test.
3. Hand-count five rows of the bid table and one tag of each kind against [the definitions](#how-each-number-is-counted).
4. Time the page's reads for San Antonio. The other reads on this tab answer in about half a second.
5. A phone's width and the dark theme.

## What to show the owner

- The page on live San Antonio data, then Austin.
- The headline count as built: how many companies we bid pulled a permit here, and how that differs from the first read and why.
- Five names the list would have him call this week, with the reason on each. He should be able to say *yes, I would call that one* or *no, and here is why*, which is the test of the order.
- What was not reached.
- The one question: may an agent look up the top names once.

## Is this the best we can do?

- **A page that leads with a call list: the pick.** The question is *who do we ask?*, and five names with reasons answer it. Charts alone would change nothing.
- **Grow Builders instead.** It lost as the home because Builders is where a name is looked up: over a thousand rows in San Antonio and no opinion. Market is the opinion, and every row on it opens the builder's sheet.
- **A Monday note and no page.** The strongest objection to a page: almost none of the permits that arrived since August were skimmed. It lost as the first build only because the note needs the same list behind it. It is the step after the list exists, and it goes to the owner.

What the question changed: no score, since a number hides its reasons; the bid table moved up to second; no second map; the plumber box only where plumbers are named; a name leaves the list when it is answered; five names, since one person calls them.

## The owner's answers, 2026-11-20

The four calls were put to the owner with a read of the live permits behind each. He took all four recommendations. The counts went to him and are not kept here.

1. **May an agent look up the top names once? Yes, in the smallest form.**
   - San Antonio only, the next 25 companies on the call list.
   - Companies only. A name that reads as one person is never looked up.
   - Kept: what kind of company it is, an office phone, one person and title. Each fact carries its page and its day.
   - Kept in a table of its own, apart from the office's marks. A looked-up fact may tag and order a name. It never takes one off the list.
   - Drawn as *Looked up, not checked* until a person presses Checked.
   - Run once by an agent. No nightly job and no new paid service.
2. **Does Austin follow San Antonio now? No. Austin waits until 2027-02-22.**
   - Austin's top names are as steady month to month as San Antonio's. That is not what is missing.
   - Its feed has no applications, so no job is ever open there.
   - Its records are too short for a trend. The trend turns on by itself on 2027-02-22, when they reach 180 days.
   - Until then every Austin name has one reason, *Never bid*, and the order is by size.
   - No city is gated in the code. Austin's Market draws today with the chips its records cannot fill left out.
   - Austin stays out of the lookups and the Monday note until that day. Its name mark is fixed first, as a change of its own.
3. **Should a name that reads as a builder lead? Yes, by a stricter reading, and a job counts once.**
   - As built, any company word made a name read as a builder. Of San Antonio's first twenty, about half were design firms or trades that need no plumber.
   - A name with a building word leads: construction, contracting, contractors or builders. The rest follow in the order as built. Nothing is removed.
   - Builders only was turned down. Too few names carry a building word to fill the weeks.
   - A job is counted once. San Antonio keeps an application and its permit as two rows, and a project of several buildings as a row a building. The audit of 2026-11-20 found that over half of the *Picking up* and *New and busy* reasons did not survive counting a job once.
4. **How long does an answer keep a name off? 90 days and a year, as built, and a name comes back only with a new job.**
   - A name whose day has come took its old place back, since the order has no key for an earlier answer. At five a week the list would have started to repeat.
   - After its day, a name is offered again only when it has applied for a job since the answer.

## Still the owner's to say

- Whether the lookups go past the first 25 names and past San Antonio, once he has called from them.
- Whether Austin's list is worth calling from, on a second read after 2027-02-22.

## Seen while building, not done

Each is a change of its own, noted here for whoever picks it up.

- **One Austin builder on the list was many companies. Fixed in v2.8114.** Austin's feed writes a `**MAIN**` mark after a contractor's name, in many spellings. When the name had a comma, as in `Name, Inc.**MAIN**`, the name splitter `contactParts` took the marked tail as the company and keyed it `main`, the same for every such contractor. `permit-pull` now takes the mark off as it reads the name (`austinName`), and migration `20261120110000` cleaned the Austin permits already stored and handed them back to the pull for their keys. No other city has the mark.
- **Austin's clock runs to a job's newest plumbing permit.** The read keeps one plumbing day per job. Running to the first one needs a column on `research_permits_v3`.
- **San Antonio's clock reads short.** An application still waiting for its permit has no second day, so it is left out. The longest waits are the ones missing. A read of 2026-11-20 found nearly half of the year's applications still waiting, and over a quarter of those older than six months with no permit at all. The feed cannot say whether a long wait is a slow review or a dead project. The clock should say how many still wait.
- **The practice bids count as our bids on the call list.** Found by the audit of 2026-11-20. `research_builders` counts every bid of any age under a name, the robots' practice bids among them. The table of companies leaves them out and looks back two years, so one name can read two counts. Needs a migration.
- **One count says *here* and means every city.** Found by the same audit. The tile and the table's column count a company's permits in all five cities and are drawn on each city's page.
- **Market does not draw its values in place.** The rule reached `CLAUDE.md` while the page was being built, in v2.7985. Its counts, days, amounts and names sit inside plain sentences. To meet it, `permitMarket.ts`, `permitCallList.ts` and `permitMarketShape.ts` mark each value with `val`, and the screens draw them with `ValueSentence`. The table's columns and the tiles already stand apart. Every value here is worked out, so each draws plain bold.
