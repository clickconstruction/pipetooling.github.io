---
name: "Permits: a Market page — who builds, and who to call"
number: 405
group: ready
status: Go 2026-11-19 · steps one and two built, v2.7978, v2.7982 and v2.7993 (the page's five parts) · the owner answered the four calls 2026-11-20, built in v2.8112, v2.8114 and v2.8121 · step three built in its smallest form, v2.8118 and v2.8121, with the first 25 San Antonio companies looked up · the audit's three lines built 2026-11-20, v2.8134, v2.8138 with v2.8147, and v2.8149 · the skim card's word and the Answered line fixed, v2.8181 and v2.8207 · Austin's clock runs to a job's first plumbing permit, v2.8252 and v2.8254 · San Antonio's applications read again by issued day, v2.8256, `permit-pull` deployed 2026-11-22 · San Antonio's clock says how many still wait, v2.8260 · the pull's second reading starts from the days held before the run and looks back 30 days, v2.8328, `permit-pull` to deploy · four of the five walks done on the live site 2026-11-22, see Left to do and to walk · the owner makes the calls
summary: >
  The only way into commercial work today is to ask a company to let us bid. A Market view on
  Prospects → Permits says which companies to ask, why now and who to ask for, and whether the
  companies we already bid actually build. It leads with a call list of five names a week, then a
  table of every company we priced for beside the permits it pulled, then a clock (how long from
  the day the city first shows a job), who holds the work where a city names the plumber, and how
  much is being built. Each row gives its reasons as tags and there is no score.
next: >
  The owner calls from the list and checks the looked-up facts as he goes. Then his word on whether
  the lookups go past the first 25 names and past San Antonio, and the Monday note.
size: L as a train of three (M · M · L)
blocker: None.
opinion: build — start with step one, which needs no research and is the table that says where estimating hours go
---

# Permits: a Market page — who builds, and who to call

Mock-up: [`mockup.html`](./mockup.html). Every company, person, address and number on it is made up.

## For whoever builds this

Read this card top to bottom, then the mock-up. Everything decided is here.

- **What is asked:** build the page in the mock-up, in the steps under [The train](#the-train-step-by-step), and show it to the owner on live data.
- **When:** the owner wants to see it the day after 2026-11-19. Steps one and two are the target. Say plainly what was not reached.
- **What is settled:** the page's five parts and their order, five names a week, no score, the owner makes the calls. Do not reopen these.
- **What is not:** how far the lookups go past San Antonio's first 25 names. That is the owner's to say once he has called from them.
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

### Step three: Ask for — built in its smallest form, 2026-11-21

**Built, v2.8118** (the two tables, [fragment](../../docs/recent-features/v2.8118.md)) **and v2.8121** (the Ask for block, [fragment](../../docs/recent-features/v2.8121.md)), from the drawing [`mockup-ask-for.html`](./mockup-ask-for.html). The owner saw it and said build it as drawn. The first 25 San Antonio companies on the list were looked up on 2026-11-20, and their facts read as not checked on the live page.

A one-time lookup of each name: what it is (a builder, an owner, a design firm, a permit service or a trade), an office phone, a person and title to ask for, each with the page it came from, the day, and whether a person checked it.

- **The question for the owner:** may an agent look up the top names of a city once? About 150 names a city, a minute each, public sources only, nobody contacted, nothing shown as checked until a person checks it.
- **His answer:** yes, smaller. See [The owner's answers](#the-owners-answers-2026-11-20).
- **What the trial showed:** a builder worth a call behind about half of twenty names. The largest filers were not builders. Two of the agents' inferences were wrong and were caught on a check, so the person's check is part of the design.
- **Where the facts are kept:** `builder_lookups`, one row a fact with its page and day, added only by a dev account. `builder_lookup_checks`, one row a press (**Checked**, **Wrong**, **Put back**), by anyone who reads permits. Both only grow. Neither touches the builder's kind, its mark or an answer.
- **How the lookups are run:** once, by an agent session signed in as the dev. One agent reads public business pages for each fact, and a second opens the same page to confirm it. The rows go in through the app's own connection. No function, no job and no paid service. The list with the real names, each fact's page and the words on it, goes to the owner outside this public folder.
- **The order:** a looked-up kind tags the name at once. It moves the name in the order only once a person checks it, the owner's pick on the drawing.
- **What is left:** the names past the first 25 and the other cities, on the owner's word once he has called from them. The block on the builder's sheet.

### After the list exists: the Monday note

The top block, five names with their reasons, sent to the owner on Monday morning. The Report Subscriptions pattern ([`docs/REPORT_SUBSCRIPTIONS.md`](../../docs/REPORT_SUBSCRIPTIONS.md)) is the way to send it.

## How each number is counted

So the built page and the first read agree, and so a hand count can check it.

- **A commercial permit:** a row of `permits` with `kind = 'building'` and not residential. Its day is the issued day, else the submitted day. *Twelve months* is that day within 365 days of today.
- **A builder:** a commercial permit's `builder_key`. San Marcos and Seguin publish no applicant, so they have none.
- **A job, on the call list:** one name's commercial permits of one day at one address, counted once (`marketJobs`, v2.8112). An application and its permit are one job, and so are the buildings of one project. The call list counts jobs. Builders, the table of companies and *How much is being built* still count permits.
- **A company we bid:** every bid made in the last two years, under its customer's name and its GC's name, keyed the way permits are (`research_name_key`). A win is an outcome of won or started. Leave out the catch-all customers a bid portal's bids sit under, and the robot's practice bids. The first read did not leave those out, so the built count will be a little lower. Say so at the showing. Since v2.8147 this rule has one home, `ourBids.ts`, and Builders and the call list count our bids by it too. Since v2.8181 the skim card's *warm · cold · new name* word does as well.
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
| Ask for | A one-time lookup of each name, kept apart from the office's word | San Antonio's first 25 names, looked up 2026-11-20 (v2.8121). Each fact reads as not checked until a person checks it. |
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
   - Kept in a table of its own, apart from the office's marks. A looked-up fact may tag a name, and moves it in the order only once a person has checked it, his pick on the drawing the same day. It never takes one off the list.
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

The audit of 2026-11-20 left five smaller things. Each is his to say, and each has a pick.

- **Two of the week's five read as likely design firms.** The name has a building word, so it leads. Pick: look the two up and press **Checked** on what they are, which moves a design firm behind the other companies. Changing the order's rule for two names is not worth it.
- **Pursue pressed twice on one name can leave the same note on its lead twice.** A pursue that finds the lead already there adds a note each time (`approachFromPermit`). Pick: leave it until it is seen on a real lead, then skip a note the lead already holds.
- **Some presses are small for a thumb.** The city counts under a company, **Tie a name** and **Put back** are words in a line, under the 44 px a phone press wants. Pick: grow them on a phone only, in one PR for the whole Permits tab, since Builders draws the same presses.
- **Austin's second tile always reads 0.** Austin's feed has no applications, so *of their jobs are applied for* can never count one there. Pick: leave the tile out where the city has no applications, as the chips already are.
- **The read of where a city's records start stops at 1,000 pull runs** (`loadRecordsStart`). It reads the oldest first, so it holds for years at one run a night. Pick: leave it, and page it the next time that read is touched.

## Seen while building, not done

Each is a change of its own, noted here for whoever picks it up.

- **One Austin builder on the list was many companies. Fixed in v2.8114.** Austin's feed writes a `**MAIN**` mark after a contractor's name, in many spellings. When the name had a comma, as in `Name, Inc.**MAIN**`, the name splitter `contactParts` took the marked tail as the company and keyed it `main`, the same for every such contractor. `permit-pull` now takes the mark off as it reads the name (`austinName`), and migration `20261120110000` cleaned the Austin permits already stored and handed them back to the pull for their keys. No other city has the mark.
- **Austin's clock runs to a job's newest plumbing permit. Fixed in v2.8254.** The read kept one plumbing day per job, the newest. Taunya said to build it on 2026-11-21. Migration `20261122032000` adds `research_permits_v4`, which is v3 with the job's first plumbing day beside its newest (`plumber_first_permit_on`), and the clock runs to that. Read on prod, counts only: of 300 Austin jobs with a plumbing permit in a year, 26 had an earlier first day, and the clock's middle moved from 7 days to 6 ([fragment](../../docs/recent-features/v2.8254.md)).
- **San Antonio's clock reads short. Fixed in v2.8260, with the pull's part in v2.8256.** An application still waiting for its permit has no second day, so it is left out. The longest waits are the ones missing. A read of 2026-11-20 found nearly half of the year's applications still waiting, and over a quarter of those older than six months with no permit at all. The feed cannot say whether a long wait is a slow review or a dead project. Taunya said to build it on 2026-11-21. A line under the clock now says how many applications of the twelve months still wait and how many of those were filed over six months ago, and the clock's own words say it holds only the ones that have their permit ([fragment](../../docs/recent-features/v2.8260.md)). Building it found that the count could not be trusted as stored: the nightly pull read an application for ten days after it was filed and never again, so one that got its permit later kept reading as waiting. `permit-pull` now reads the applications a second time by issued day ([fragment](../../docs/recent-features/v2.8256.md)). The count is right once that function is deployed.
- **The practice bids count as our bids on the call list. Fixed in v2.8138 and v2.8147.** Found by the audit of 2026-11-20. `research_builders` counted every bid of any age under a name, the robots' practice bids among them. The table of companies leaves them out and looks back two years, so one name could read two counts. Migration `20261120150000` gave the rule one home on the database (`research_bid_counts`, `research_bid_party_key`), and `ourBids.ts` is its one home in the client, which the table and a tied customer's count both read ([v2.8138](../../docs/recent-features/v2.8138.md), [v2.8147](../../docs/recent-features/v2.8147.md)).
- **The skim card's *warm · cold · new name* word still counts every bid ever made. Fixed in v2.8181.** Seen while fixing the line above. It read `research_contact_history`, which had its own count of our bids under a name, of any age and with the practice bids. Taunya said to build it on 2026-11-21. The function counts by `research_bid_counts` and `research_bid_party_key` now, and **new name** says *no bid to this name in the last two years*.
- **One count says *here* and means every city. Fixed in v2.8134.** Found by the same audit. The tile and the table's column count a company's permits in all five cities and are drawn on each city's page. The count stands, since [How each number is counted](#how-each-number-is-counted) says all five cities. The words changed: the tile says *in the cities we read*, the column *Permits, all cities, 12 mo*, the chip *Builds* ([fragment](../../docs/recent-features/v2.8134.md)).
- **Market does not draw its values in place. Built in v2.8149.** The rule reached `CLAUDE.md` while the page was being built, in v2.7985. Its counts, days, amounts and names sat inside plain sentences. `permitMarket.ts`, `permitCallList.ts` and `permitMarketShape.ts` now mark each value with `val`, and the screens draw them with `ValueSentence`. The table's columns and the tiles already stood apart. Every value here is worked out, so each draws plain bold and none is a press ([fragment](../../docs/recent-features/v2.8149.md), with before and after pictures on made-up data).
- **An answered name's line can end a reason with two full stops. Fixed in v2.8207.** Seen while building the line above. A pursue keeps its reason with a full stop, and the line under **Answered** added its own: *Pursuing, Pursued for this job..* Taunya said to build it on 2026-11-21. `standingWords` takes the reason's own full stop off and ends the sentence once.

## Left to do and to walk (2026-11-22)

Written for someone on another computer who has not seen the build. Every line of [Seen while building, not done](#seen-while-building-not-done) is fixed or has a PR. What is left is below. The owner's calls stay under [Still the owner's to say](#still-the-owners-to-say), each with its pick.

### Walks

Four of the five were walked on 2026-11-22: on the live site, signed in as the dev, read only, at 1100 px and 375 px, light and dark. Every number below was measured on the page. The walk came after migrations `20261122230500` and `20261122233000` were pushed and `permit-pull` was deployed from main, so a lawn sprinkler, gas or sewer permit no longer counted as a plumber. One walk is still owed.

Whoever walks next: the rows are real companies, so read only. Press no Pursue, no answer, no **Checked** and no save.

- **Austin's clock runs to the first plumbing permit (v2.8254). Walked, reads as it should.** The clock reads *Austin · building permit to the plumber's permit*. Its middle is 6 days and its middle half 1 to 15 days, over 303 jobs. The page asked `research_permits_v4` once and was answered. The three values are bold, and none is underlined or a press. The note takes 3 lines at 1100 px and 4 at 375 px, and nothing runs past the screen at either width.
- **San Antonio's clock says how many still wait (v2.8260). Walked, reads as it should.** The note reads *Half of the applications that have a permit waited 50 days or more for it*, with a middle half of 30 to 90 days over 1,059 applications. The second line reads *817 of the 1,876 applications filed in twelve months still wait for a permit*, says the clock reads short, and says 234 were filed over six months ago. Its three counts are bold, and none is underlined or a press. The line takes 2 lines at 1100 px and 5 at 375 px, inside the screen. The values stand at 17 to 1 against the page in dark and 15.8 to 1 in light. The grey words around them stand at 7.0 to 1 in dark and 4.3 to 1 in light, a little under the 4.5 that small words want. That grey is the app's muted colour on the page's own ground, so it is not this line's to fix.
- **San Antonio's waiting count after the pull caught up (v2.8256). Walked, reads 8 over the city's own count.** The page says 817 of 1,876. The city's feed, read the same hour, lists 1,872 commercial applications filed in twelve months: 1,063 with a permit and 809 still waiting. The app holds every one of them. Of the 8 over, 4 are the second reading's loose end below, and 4 are applications the city no longer lists, also below. The city lists 13 numbers twice, once with a permit and once without, and the app reads each of those as having its permit.
- **An answered name's line ends with one full stop (v2.8207). Still owed.** It could not be walked. No real name is answered on the live database: its two answers are a made-up test name's, answered and put back on 2026-11-20, so no city draws **Answered**. Walk it the next time someone pursues a name from the list, since a pursue's reason carries its own full stop. The render test draws the line.
- **The skim card's word (v2.8181). Walked, reads as it should.** At `/prospects?tab=permits`, Skim, San Antonio, the top card's name reads **new name**. The words *no bid to this name in the last two years* are drawn on the line under it, so a phone needs no hover. The hover is on the Ledger's chip: all 200 chips drawn there read **new name** and carry the same words. The chip stands at 8.0 to 1 in light and 7.0 to 1 in dark, and the line under it at 4.8 and 5.8. At 375 px the line wraps to two and stays inside the card.

### Loose ends

- **The pull's second reading starts too late after a jump. Built in v2.8328 on the owner's go of 2026-11-22, deployed 2026-11-23, and proven by that morning's run.** `permit-pull` worked out each reading's start as that reading began, so the second reading counted its ten days back from an issued day the first reading had just written. On 2026-11-22 the first reading moved that day forward by a week, and the second skipped permits the city had dated just before its new start. Counted again on 2026-11-22 against the city's feed: 4 commercial applications and 5 for houses, all issued on 2026-11-09, read as waiting. Nothing read them again. Now every reading's start is worked out before either writes, and the second looks back 30 days ([fragment](../../docs/recent-features/v2.8328.md)). `permit-lookup` bundles the same shared files, so the drift check names it until it is deployed too. `permit-pull` was deployed at 08:42 UTC on 2026-11-23, and the 11:30 UTC run that followed wrote the issued day of 2026-11-09 onto 14 applications, 5 commercial and 9 for houses, that had read as waiting the day before, read off `permits` by `pulled_at` and `issued_on` after the run. The run's log line, where `issuedSince` would read 30 days back, was not read: the function's logs are on the dashboard alone. Taunya said *Not now* on 2026-11-22, and the owner's go came later the same day.
- **An application the city takes off its feed reads as waiting.** Found on the walk of 2026-11-22. The pull adds and updates and never takes a row off, so an application the city stops listing waits until it is a year old. Today that is 4 commercial applications of the 817, and 12 for houses. Telling them apart asks one read of the city's whole list of numbers a night, a mark on a row the city no longer lists, which is a migration, and the clock leaving marked rows out. Pick: leave it while it is 4 of 817.
- **The Ask for block is not on the builder's sheet.** Step three left it. The looked-up facts show on the call list only. It is one PR and no migration: the sheet reads its one name's facts as the call list does (`builderLookups.ts`), draws `PermitAskFor`, and gains a render test and a line in the guide.
- **No looked-up fact stands as checked.** 58 facts are held under 26 San Antonio names. Three presses were made by 2026-11-22, all on one fact, and the last was **Put back**. The owner checks them as the calls are made. Nothing to build.
- **The Monday note is not built.** It waits on the owner's word, after the calls. It is a stream on the Report Subscriptions pattern: a table of who gets it, which is a migration, a function on a Monday timer that builds the five names and sends them, and its line on My email schedule. The list is worked out in the browser today, so the large part is giving that function the list's kernels (`permitCallList.ts`, `permitMarket.ts`, `ourBids.ts`) and the reads behind them.
- **The owner's calls, with what the page does until then:** the lookups stay at San Antonio's first 25 names; Austin's list draws with *Never bid* as its one reason, ordered by size, until 2027-02-22; none of the five audit picks is built, so the page does what each of those lines describes.
