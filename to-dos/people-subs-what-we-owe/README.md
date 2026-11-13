---
name: "People → Subs shows what makes up what we owe each sub, by job and sheet, and a sheet with several names is counted once"
number: 346
group: ready
status: looked at 2026-11-13 on the live app and read on prod through the dev seat, nothing written; the counting rule is fixed in its own PR (#7974, client only); the rest is drawn, the page as it is beside the recommended design and one alternative, at desktop and phone width
summary: >
  The owner asked to dig into what makes up what we owe each sub on People → Subs, as he can on
  Jobs → Subs → Pay, and passed on the office's report that the app encourages double counting
  when two people are on a job. No dollar is owed twice on prod today. The report is still right
  about the push: the page called a sheet with a sub and a teammate broken, left its money off
  every Balance due, and offered two ways out, wipe the other names or make a second sheet. The
  two pages disagreed on one sub by $2,150, fixed in PR #7974. The card adds the row that opens
  into jobs, sheets and lines with a total that adds up, the same from a job, a band that says
  where a shared sheet's money is counted, and the Pay view's acts opened in place.
next: the owner's look at the mock-up and his answer to question 1 (two subs on one sheet); PR 1 (the row opens, read only) needs no answer
size: M as a train of seven (S · S · S · S · S · M · M)
blocker: none for PR 1 to PR 5; PR 6 is an edge deploy and waits on the owner's yes; PR 7 waits on question 1
opinion: build PR 1 now, it reads what the page already loads and answers the ask by itself; take PR 2 next, since the band and the form are where a second sheet for the same work would start; PR 6 matters more than its place in the list says, because a sub's portal can state money a teammate's portal states too
mockup: to-dos/people-subs-what-we-owe/mockup.html
---

# People → Subs shows what makes up what we owe each sub (#346)

## The ask

The owner, 2026-11-13, with a screenshot of People → **Subs**:

> I would like to improve the user's capability of this page. I would like to be able to dig into
> jobs and see what makes up what we owe people. Also [the office] reports that the app
> encourages double counting when two people are on a job. I want that page to be as powerful as
> this page: Jobs → Subs → Pay.

## The short answer on double counting

**No dollar is owed twice on prod today. The report is right that the app pushes toward it.**

Read on 2026-11-13, counts only: 88 sub sheets on 49 jobs, $13,400 open on 7 sheets.

- 8 sheets carry several names. They hold $4,350 agreed. 7 are paid in full. One has $2,150 open.
- Under the Pay view's rule every one of the 8 has exactly one sub on it. The other names are teammates.
- No sheet has two subs on it. No sheet is counted in two subs' Balance due.
- No job has the same line and amount on two sheets. No two sheets share a job, a date and a total.
- 2 more sheets, $6,000 agreed and paid, are crew sheets: a teammate and no sub.

What was wrong is the other direction. People → Subs left the $2,150 off the sub's Balance due, and the Pay view showed it as owed. The page's column summed to $11,250 against the Pay view's $13,400. PR #7974 makes the two agree.

## How the numbers are built

One kernel prices a sheet on both pages: `subLaborJobBalance` (`src/lib/subLaborOutstanding.ts`).

- **Agreed** is the sum of the sheet's lines (`people_labor_job_items`): a line's direct amount, or hours times the rate.
- **Paid** is the sum of its payments at or above zero (`people_labor_job_payments`).
- **Backcharged** is the sum of its payments below zero. A backcharge is a payment row with a minus sign.
- **Open** is agreed, less paid, less backcharged. An overpaid sheet counts as zero. It never nets against another sheet.

A sheet is tied to people by `people_labor_job_assignees`, one row per person. A trigger (`sync_people_labor_job_assignees`) rebuilds those rows from the sheet's name text, `assigned_to_name`, split on ` | `, each name matched to the roster by `resolve_pay_person_id`. The form's Crew step writes that text from its chips.

Where the pages differed is **who a sheet is for**.

| | Jobs → Subs → Pay | People → Subs, before PR #7974 |
|---|---|---|
| Kernel | `sheetParties` → `buildSubLaborPayRun` | `buildSubsHqRows` |
| Who is a sub | kind `sub` with no login or a `subcontractor` login (`isRosterSub`) | any active person of kind `sub` |
| A sub and teammates | the sub's sheet, whole. Teammates read *with …* | *Multiple subs*, on nobody's row |
| Two subs | one group named for both, whole, once | *Multiple subs*, on nobody's row |
| Teammates and no sub | Crew pay, counted as a sheet, never as owed | *No roster match* |
| A name the roster does not know | a group of its own | *No roster match* |

Two people on the Subs roster carry kind `sub` behind a team login. That is the whole difference: a sheet with one of them and a sub read as two subs.

**Can the two pages show a different amount for one sub?** Before the fix, yes, for any sheet with a sub and a teammate of kind `sub`. After it, they read one rule. The one case left is a sheet with two real subs. The Pay view shows it under a pair, and People → Subs shows it on nobody's row. Neither counts it twice. There is none on prod.

**What Assign… writes.** It sets `assigned_to_name` to the one roster name picked, on every sheet in the band's row, then upserts the junction row. On a *Multiple subs* row that wipes every other name off the sheet. Teammates named for the record are gone from it.

## Every way two people on one job could be owed twice

| Route | The app allows it | The app nudges it | It has happened |
|---|---|---|---|
| One sheet linked to two subs, each owed in full, on the office's pages | No. Both kernels put a sheet in one place | No | No |
| One sheet's whole balance shown to each person on it, on **their** screens | **Yes.** The sub portal, the sub's *Your money* card and a person's hours statement list every sheet a person is on, in full | No | **In part.** One open sheet, $2,150, has four people on it. Three have a row and a portal globe on the Subs roster. Any portal opened for one of them states the $2,150. I did not open one |
| One piece of work entered on two sheets | Yes. Nothing checks a new sheet against the job's others | **Yes.** The band called a mixed sheet unlinked. Its two ways out were wipe the names, or a sheet per person | No. 0 matching lines, 0 matching sheets |
| A helper's hours on a sub's sheet and on their own clock | Yes, and both are real costs: the sub's price and the helper's wage. The helper is owed nothing on the sheet | No | Teammates on 9 of the 10 sheets also clocked hours on the job. Not a double count |
| A crew sheet's dollars and the same teammate's wages, both in the job's cost | Yes. Job Summary adds every sheet on the job and every clocked hour | No | 2 crew sheets, $6,000, both paid. The owner's call 6 |
| A payment recorded against one sheet and not its twin | Only if a twin sheet exists | No | No |
| The scoreboard's share of a sheet | Review and Team Summary credit a sheet in equal shares to its names (the owner's call of 2026-10-09). The shares add to one sheet | No | 5 sheets write one person twice, short name and full name. That person's second share lands on nobody. My reading of the kernel, about $375 of credit |

## What PR #7974 fixed

The rule is the Pay view's, now on both pages:

1. A sheet is its sub's. A teammate on it rode along and is paid through payroll. The whole sheet counts once, on the sub.
2. A sheet with two or more subs is shared. It is on nobody's row, in the band, counted once.
3. A sheet with teammates and no sub is crew pay. It is in nobody's Balance due.
4. A name the roster does not know keeps the sheet in the band, so a sub's money cannot go quiet.
5. One person named twice on a sheet is one person.

Tests pin each case, and one invariant: every open dollar sits in exactly one place. On prod the band went from 10 sheets to none and the column sums to the Pay view's total. No stored row changed.

How two subs **split** a shared sheet is a business choice. Nothing was built for it. It is question 1.

## The two pages compared

| | Jobs → Subs → Pay | People → Subs |
|---|---|---|
| Grain | a sheet, grouped by sub | a sub |
| What makes up a sub's balance | **every sheet**: job, agreed, paid, due, where it stands, pay when | **one figure**, not a press |
| A sheet's lines, payments, backcharges | **yes**, the row opens | no |
| Tiles: owed, ready now, queued, not payable and why | **yes** | no |
| Why a sheet cannot be paid yet | **yes** | no |
| Record a payment, a backcharge. Move or remove one | **yes** | no |
| Stage, payable after, hold, the pay-run day | **yes** | no |
| Draft a work order, send a lien waiver, print a sheet, the sheet's story | **yes** | no |
| New sheet, edit a sheet, who is on it | **yes** | Assign… only |
| Search, filter chips, paid sheets | **yes** | bench chips only |
| Sort, export, a statement for one sub | no | no |
| Phone layout | **yes**, rows open a sheet | no, a six-column table scrolls sideways |
| Door to the job | the job's name, as text | no |
| The sub's portal visits | **yes** | the globe only |
| The roster: who is a sub, login, email | no | **yes** |
| Compliance: agreement, COI, W-9, license, General Conditions | no | **yes**, with the documents fold |
| The bench: active, benched, last worked, quiet for months | no | **yes** |
| Open work orders by sub | on each sheet | **yes**, one column |
| Track record: sheets, settled, backcharged | no | **yes** |
| Sheets that need a sub | shows them under a pair | **yes**, the band |
| Who reads it | owner, dev, assistant, controller. A superintendent, only sheets they are named on | owner, dev, assistant, controller |

The gap is the top half of the right-hand column. That is the brief.

## The design

Mock-up: `to-dos/people-subs-what-we-owe/mockup.html` (on the dev server at `/to-dos/people-subs-what-we-owe/mockup.html`). Made-up names throughout.

**Recommended: the row opens.**

- **Balance due is a press.** It opens a full-width row under the sub, as Documents does. The row lists each job with money open, each sheet on it, and under a sheet its lines, payments and backcharges.
- **It adds up in sight.** A strip reads agreed, less paid, less backcharged, equals still open. The foot reads the jobs' sums equal the figure in the column. The check mark draws only when they match.
- **Doors.** *Open the job ›* opens the job's window. *Open the sheet ›* opens the sheet's own window on Jobs → Subs → Pay. *Open in the pay run ›* lands on the Pay view searched to that sub.
- **Each sheet says where it stands**, in the Pay view's own words: ready to pay, queued, waiting on customer, no agreement, still in work.
- **Paid sheets** sit behind a chip, so a settled sub still has a history to read.
- **The page gets the Pay view's reach**: the tiles on top, an *Owed* chip, a search across subs and jobs, a sort, an export, and a statement to print for one sub.
- **On a phone** each sub is a card, and the card opens a sheet that is the same block.

**The same from a job.** The job's window gets *Subs on this job*: each sub, their sheets on the job, and the same strip. A sub's name links to their row. The block flags two sheets on the job that carry the same line and amount.

**Shared sheets, where the person stands.**

- The band lists only a sheet with no sub or with two. Its words say the money is counted once, there, and in no Balance due.
- **Assign…** becomes **Whose is it…**. The window shows what each choice adds to each sub's balance before anything is saved, and that the parts sum to the sheet. No press links one sheet to two subs.
- The sheet form's Crew step speaks when a second sub is picked, and offers to start that sub's own sheet. Teammates stay free to add.
- A teammate with a row on the Subs roster carries a chip and reads *payroll*.

**One place for each act.** Payments, backcharges, stages, the pay run, work orders and lien waivers stay the Pay view's. People → Subs opens the Pay view's own windows on a sheet. Who a sheet is for stays the sheet form's. The roster, compliance and the bench stay People → Subs's. The table is in the mock-up, section 6.

**Roles stay as they are.** The row reads the tables the column already reads, under the same policies. The job's block shows for the roles who open Jobs → Subs → Pay today. Nothing here reaches a role that does not see sub pay now.

**The alternative: a Money tab on the sub's desk.** Balance due opens the desk the sub's name already opens. The table stays short, and one drawer serves the roster, the pay run and a job. It costs a step, and two subs cannot be read side by side. Both designs draw one block from one kernel, so the pick can change late.

## The plan

Shipped with the card: **PR #7974**, the counting rule. Client only.

1. **The row opens** (S). A pure kernel `subOwedBreakdown` over what the tab already loads: sub → job → sheet → lines, with the sums and an `addsUp` flag. Balance due becomes a press. Open and paid chips. Doors to the sheet and the job. The phone's card and sheet. Guide `review-your-subs`. No migration.
2. **The band and the form** (S). The band's words, *Whose is it…* for a name the roster does not know and for one sub, the Crew step's line when a second sub is picked, the same-line check on save, the teammate chip. No migration.
3. **Acts in place** (S). Pay… and Back-charge… on a sheet in the open row mount the Pay view's own modals. *Open in the pay run ›*. The pay run's sub name gains *What we owe ›*. No migration.
4. **From a job** (S). *Subs on this job* in the job's window, from the same kernel grouped by job. No migration.
5. **Reach** (S). The tiles, the Owed chip, the search, the sort, the export, and one sub's statement to print, filed as a sent copy. No migration.
6. **The sub's own screens** (M, the owner's yes). The sub portal, *Your money* and the hours statement show a sheet's dollars to its sub alone. A teammate sees the sheet with no figure. Edge deploy of `sub-portal`. No migration.
7. **Split a shared sheet** (M, after question 1). *Each sub did part of it* turns one sheet into one per sub, lines and payments placed by hand, sums checked. One definer RPC, migration `…_split_sub_sheet.sql`. Built only if the owner picks the split.

## The owner's calls

1. **Two subs on one sheet. How is it owed?** My pick: a sheet each, by line, and until then it is on nobody's row. The other choices are equal shares, or one sheet paid to the pair.
2. **Should the form stop a second sub on a sheet?** My pick: warn and offer the second sheet. Do not block.
3. **Should a teammate on a sub's sheet see that sheet's dollars on their portal?** My pick: no. They see the job and *paid through payroll*. PR 6 needs your yes to deploy.
4. **Should the two teammates stay on the Subs roster?** My pick: yes, with a chip, left out of the Active count.
5. **The scoreboard splits a sheet by its names. Keep it?** My pick: keep it, and count one person once when a sheet writes them twice.
6. **Is a crew sheet extra pay, or the same pay as the hours?** If it is the same pay, the job's cost counts it twice. I do not know which. Two sheets, $6,000.
7. **Clean-up, proposed and not run:** on the 5 sheets that write one person twice, take the short name off. It changes no balance. The list is in the session's notes, not in the repo.

## How to verify

- The kernel cases: `npx vitest run src/lib/people/subsHqRows.test.ts`.
- The live read, nothing written: sign the pane in with `node scripts/dev-pane-login.mjs "/people?tab=subs"`. Sum the Balance due column. It equals *Owed to subs* on Jobs → Subs → Pay, less any sheet in the band.
- To walk a press, use the test sub on the roster and a ZZ Test job. Never a real sub.
