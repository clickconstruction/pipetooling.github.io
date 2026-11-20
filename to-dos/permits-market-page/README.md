---
name: "Permits: a Market page — who builds, and who to call"
number: 405
group: waiting
status: Proposed 2026-11-19 · a mock-up drawn from a first read of the live permits and bids · the owner makes the calls (his word, the same day) · nothing built
summary: >
  The only way into commercial work today is to ask a company to let us bid. A Market view on
  Prospects → Permits says which companies to ask, why now and who to ask for, and whether the
  companies we already bid actually build. It leads with a call list of five names a week, then a
  table of every company we priced for beside the permits it pulled, then a clock (how long from
  the day the city first shows a job), who holds the work where a city names the plumber, and how
  much is being built. Each row gives its reasons as tags and there is no score.
next: >
  The owner's go on the first step, the bid table and the clock for San Antonio, which need no
  research. Then his word on whether an agent may look up the top names of a city once.
size: L as a train of three (M · M · L)
blocker: The owner's go on step one, and his word on the one-time lookups before step three.
opinion: build step one — it needs no research, and it is the table that says where estimating hours go
---

# Permits: a Market page — who builds, and who to call

Mock-up: [`mockup.html`](./mockup.html). Every company, person, address and number on it is made up.

## The ask

The owner, 2026-11-19, after the permit fixes of that day ([v2.7922](../../docs/recent-features/v2.7922.md), [v2.7935](../../docs/recent-features/v2.7935.md), [v2.7966](../../docs/recent-features/v2.7966.md)) and a trial that looked up twenty San Antonio builders:

> *"Knowledge really is power, so will you be able to help me think of what a page could look like that shows useful insights as to things that we can use to make great decisions and track down great companies. Right now our only real method for commercial work is to contact a company and ask them to let us bid their work."*

Asked who would own the calls the page produces, he answered: *"I would."*

## What a first read of the data found

Read on 2026-11-19 through the app's own reads, signed in, writing nothing. The counts were given to the owner and are not kept in this public folder.

- **The companies we bid and the names on the permits barely overlap.** The match is by exact name, so the real overlap is larger. It is still the finding to explain, and the reason the bid table sits second on the page.
- **Hundreds of names pull three or more commercial permits a year in San Antonio.** We have a bid on record with a handful of them.
- **A San Antonio application comes weeks before its permit.** That is the window to call in.
- **In Austin the plumber's permit lands within days of the building permit.** By the time the feed shows the job it is taken. Austin is read for who builds, not for the job.
- **In Austin a few plumbers hold a large share of the named jobs**, and some builders use a different plumber on every job. Those builders are the open doors.
- **No builder carries a mark or a kind yet.** The page starts without the office's own judgement.

## The page

A view on Prospects → Permits, beside Builders. In order:

1. **Call this week.** Five builders, ranked, each with its reasons as tags (*Picking up*, *New and busy*, *Never bid*, *3 jobs open now*, *We bid 4, won 0*), the jobs it has applied for with no plumber yet, and who to ask for. **Pursue** makes the lead the skim's Pursue makes. A name leaves the list when it is answered.
2. **Do the companies we bid build here?** Every company we priced for in two years beside the permits it pulled. *Builds, and we win* · *Builds, we never win* · *No permit on record*, which offers **Tie a name**, since a company may file under a person or an expediter.
3. **The clock.** San Antonio: application to permit. Austin: building permit to the plumber's permit.
4. **Who holds the work.** The plumbers on the permits, and how tied each builder is to one. Drawn only where the city's permits name a plumber (`cityNamesPlumbers`).
5. **How much is being built**, what kind and how big.

## What each part stands on

| Part | Reads | How solid today |
|---|---|---|
| Busy, picking up, new | Building permits by name, the last 90 days against the 90 before | Solid in San Antonio, whose records start in January 2025. Three months old in the other four cities. |
| Open now | An application with no plumbing permit tied to it (`permit_address_plumbing_counts`) | Solid in San Antonio since v2.7922. Austin's feed has no applications. |
| Do the companies we bid build | Our bids' customers and GCs matched to permit names | Weak until names are tied: the match is exact, and San Antonio's applicant is often a filer. |
| Ask for | A one-time lookup of each name, kept on the builder | Not built. The trial found a builder worth a call behind about half of twenty names. Every fact needs its source and a person's check. |
| The clock | The days between the dates on the permits | Solid. |
| Who holds the work | The name on a plumbing permit at the job's address | Austin and New Braunfels only, and thin after three months. |
| How big | The value and the square feet on the permit | Most San Antonio permits have a value. Austin's values look unreliable. |
| Good, Avoid, the kind of company | The office's marks | Empty until they are said. |

San Marcos and Seguin publish no applicant, so nothing by builder can be drawn there.

## Is this the best we can do?

- **A page that leads with a call list: the pick.** The question is *who do we ask?*, and five names with reasons answer it. Charts alone would change nothing.
- **Grow Builders instead.** It lost as the home because Builders is where a name is looked up: over a thousand rows in San Antonio and no opinion. Market is the opinion, and every row on it opens the builder's sheet.
- **A Monday note and no page.** The strongest objection to a page: almost none of the permits that arrived since August were skimmed. It lost as the first build only because the note needs the same list behind it. It is the step after the list exists, and it goes to the owner.

What the question changed: no score, since a number hides its reasons; the bid table moved up to second; no second map; the plumber box only where plumbers are named; a name leaves the list when it is answered; five names, since one person calls them.

## The train

1. **The bid table and the clock**, San Antonio first. No research. One read beside `research_builders`.
2. **The call list** with its reasons, and Pursue.
3. **Ask for**: the one-time lookups, their sources and the person's check. Needs the owner's word first: about 150 names a city, public sources only, nobody contacted.

Then the Monday note of the top block.

## Still the owner's to say

- The go on step one.
- Whether an agent may look up the top names once.
- Whether Austin follows San Antonio or waits for more months of records.
