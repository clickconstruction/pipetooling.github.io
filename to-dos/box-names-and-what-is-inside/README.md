---
name: "Box names: a letter and a number, with what is inside on its own line"
number: 351
group: gated
status: asked 2026-11-13 · the owner's seven calls taken 2026-11-14 · PR 1 (the name) v2.7276 · PR 2 (what is in it) v2.7348, 2026-11-15 · stop: add ten boxes on a real site
mockup: to-dos/box-names-and-what-is-inside/mockup.html
summary: >
  A box's name is one free field of 24 characters, and nothing says what is in a box, so people type the
  contents into the name. The card proposes two things in its place. The name is one to three letters and a
  number from 1 to 999, and the app offers the next free one on the site, so nobody types it. What is in it
  is a line of its own, written by the app from the box's parts until a person says it better. Words typed
  into the name are moved to that line, not refused. Old names keep working, and one window tidies them.
next: stop: add ten boxes on a real site. A person adds them and reads whether the app's line is right. PR 3 (Tidy) and PR 4 (the line on a label) are not built before that.
size: M as a train of four (M · M · S · S); PRs 1 and 2 are built and close the loop
blocker: stop: add ten boxes on a real site · a person's ten boxes come before PR 3 and PR 4, and no session builds either until then
opinion: build PRs 1 and 2, then add ten boxes on a real site before the tidy — whether the app's own line reads right is known only there
---

# Box names: a letter and a number (#351)

This card sits beside **Materials on site** (#209), **Stickers before boxes** (#329) and the **Edit** press on
a box (v2.7179). Nothing in the ledger changes here. It changes what a name may be and adds one line.

## The ask

The owner, 2026-11-13, after a read-only look at one development's boxes and the Edit press that followed:

> further, when someone is making a card in the future, I think we need to standardize what they can write
> such as [A-Z]+[1-999] and then leave a material description after the fact, can you look at the app
> holistically and show me what is here and what it could be in a mockup that well supports our team. think
> about the flow a user may engage in to so what we build is smart intuitive and simple

## What the app does today (read 2026-11-13)

- **A name is one free field.** `job_containers.label`, 1 to 24 characters, one live name a job
  (`job_containers_live_label_key`). Both Add screens upper-case and trim it and check nothing else.
- **The phone always offers A1.** `AddContainerSheet` in `TallyOnSiteTab.tsx` calls `nextLabel(existing, 'A')`,
  whatever letter the site's boxes carry. It opens on Cage.
- **The office page has no kind.** The Add row in `JobsMaterialsTab.tsx` saves `kind: 'cage'` for every box.
- **Nothing says what is in a box** but its part lines. No column, no line on a row. The lists show the name,
  the kind and a count of parts.
- **A name is checked against one job.** A development's boxes sit under more than one job
  (`jobs_ledger.development_id`), so one site can hold a name twice.
- **The name is what a label prints large** (`tapeLabel.ts`), and what a Print labels chip reads
  (`LabelsPrintModal.tsx`). The search reads a name, a kind and the part lines (`boxSearch.ts`).
- **Edit** changes a name, a kind and a where line since v2.7179, to any free text (`editBox.ts`).
- **The dev seat** adds a box with any label (`dev_on_site_write`, `add_container`).
- **A job combine or a whole-job move** renames a clashing box `A1 (2)` (`on_site_carry_job`), which is not a
  letter and a number.

Read on one real development, rounded: about four names in five were already a letter and a number. About
one in seven carried words, either the contents or that there was no box. Three were the sheet's own A1 or
A2, retired within minutes. Every box was a cage.

## The design

### 1 · The name

- **One to three capital letters, then a number from 1 to 999.** No zeros in front; one letter after the
  number allowed, `G24B` (call 1, the owner's change: Gun Dog has three such cages today). `R7`, `R89`, `AB12`.
- **Offered, not typed.** Add opens on the next free name: the letter most live boxes on the site carry, and
  one past its highest number. A retired box's number is not offered again. The first box on a site with no
  boxes asks for the letter once.
- **One of a kind across the site** (call 2): offered and checked against every job of the development, and
  against the one job when the job is on no development.
- **Words are moved, not refused.** `R76 TOILETS` typed into the name becomes the name `R76` and the line
  *Toilets*. Words alone take the next free name and become the line. The sheet says what it did.
- **How it sits** is asked on both pages and opens on the kind the person used last.

### 2 · What is in it

- **One line, at most 80 characters, on the box.** Never asked for.
- **Written by the app until a person says it better** (call 3). One kind of part: its name and count,
  *Kohler toilets · 24*. Several: *7 parts: 1-1/2 coupling, 2 inch 90 and 5 more*. Empty: nothing.
- **A person's own words win** from the moment they are typed, on the box's screen (**Say it better**) or
  in **Edit**. Clearing them hands the line back to the app.
- **Where it shows**: under the name on the box's screen, on each row of both lists, on the office card, on
  the Print labels chips (*R76 · Kohler toilets*), on the scanned page signed out, and in the search.
- **On a printed label** (call 4): small, on a loose pile's label only. A cage's label keeps *Scan for what
  is inside*.

### 3 · The old names

Old names keep working. **Tidy the names** on the office page lists each name that is not a letter and a
number with what it becomes, acts on the clean ones in one press and holds the rest with a reason
(`batchWords`). The words of an old name become its line, and *no container* or *pile* in a name sets the
kind to Loose pile instead. A label already printed still opens its box, since the code never comes from
the name.

## What needs a migration

- **PR 1**: a trigger on `job_containers`, `BEFORE INSERT OR UPDATE OF label`, that refuses a name off the
  rule for every kind but Unsorted. A trigger and not a check, so a row with an old name can still be moved,
  pinned and retired. `on_site_carry_job` gives a clashing box the next free name in place of `A1 (2)`.
  `dev_on_site_write` holds its `add_container` to the rule.
- **PR 2**: `job_containers.description text` (nullable, at most 80 characters). `box-read` and
  `_shared/boxPage.ts` answer the line and are redeployed.

## The plan

| PR | What | Size |
|---|---|---|
| 1 · the name (built, v2.7276) | Kernel `src/lib/materials/boxName.ts` (read a typed name, split the words off, the next free name across a site, the verdict) with tests. Add on the phone and the office page, with the kind on the office page and the last kind remembered. Edit's name field. The trigger, the combine's renumber, the dev seat. The guide | M |
| 2 · what is in it (built, v2.7348) | The column. Kernel `boxLine.ts` (the line from the parts, a person's words over it). The box's screen, both lists, the office card, the search, the scanned page, the Print labels chips. Words typed into a name land here | M |
| | **Stop and add ten boxes on a real site.** The train is here since 2026-11-15. | |
| 3 · tidy the old names | The window, its batch and its holds | S |
| 4 · the line on a label | Only if call 4 says to print it | S |

**Where it plugs in:** `onSite.ts` (`nextLabel`), `editBox.ts` and `EditBoxForm.tsx` (the name field),
`TallyOnSiteTab.tsx` (`AddContainerSheet`, the rows, the box's header), `JobsMaterialsTab.tsx` (the Add row,
the card heading), `onSiteStore.ts` and `onSiteWrites.ts` (the new column in a write), `boxSearch.ts`,
`LabelsPrintModal.tsx`, `tapeLabel.ts`, `siteRollup.ts` (the site's boxes, for the next free name),
`BoxPublicPage.tsx`, `supabase/functions/box-read`.

**With #329:** a new box made from a blank sticker was to be named by the sticker's number (its call 7).
Under this card it takes the site's next free name instead, which #329's PR 3 already draws as a second
press. One sentence of that card changes when both are built.

## The owner's calls

Each is one card on the mock-up with my pick first.

| Call | My pick | Also possible |
|---|---|---|
| 1 · the shape of a name | One to three letters, then 1 to 999 | One letter allowed after the number (`R24B`) — **taken as well** |
| 2 · one of a kind across what | The whole site | One job, as today |
| 3 · who writes the line | The app, until a person says it better | Always typed |
| 4 · the line on a label | A loose pile's label only | Every label, or none |
| 5 · the old names | The Tidy window, when the office chooses | Leave them |
| 6 · the site's letter | The letter most of the site's boxes carry | A letter for each place |

## What I would not build

- A line that must be typed before a box can be added.
- A code for each single item on a pallet. That is #209's V3.
- A free-text name kept as a setting.

## How to verify

- Dev server from a worktree, `/dev-login?as=1`. Prod is the only database: read, never write. A walk that
  writes uses the ZZ test job's boxes.
- The mock-up was checked at 375, 768 and 1400 wide, light and dark, with no sideways scroll. Its name
  field works: type a name and read what it becomes.
- Made-up names, jobs, numbers and counts only, in the repo, the PRs and every screenshot.

## Where it stands

2026-11-13: the card and the mock-up. Nothing is built. The Edit press of the same day (v2.7179) is the
one place a name can be changed, to any text, until PR 1 holds it to the rule.

2026-11-13, later: **a printed label carries the letters and number alone** since v2.7195, on the owner's word that a label should not depend on the rest of the name. `G12 COPPER 90` prints `G12` on tape, on the sheet and in the CSV (`labelPrintNames` in `labels.ts`). That settles half of call 4 ahead of the train: no words on a cage's or a box's label. Whether a loose pile's label adds the line is still the owner's call.

2026-11-14: **the owner took the six calls, with one change and one addition**, quoted from the session that asked him: "Yes, as picked" to (1) one to three letters then a number from 1 to 999 **and one letter after the number allowed** (`G24B`; Gun Dog has three such cages today), (2) one of a kind across the whole site, (3) the line is the app's until a person says it better, (4) the line prints on a loose pile's label only, (5) old names stay and the Tidy window changes them when the office chooses, (6) the site's letter is the one most of its live boxes carry, asked once on a site with none, and (7) a new box made from a blank sticker (#329, its call 7) takes the site's next free name, not the sticker's number, with the number shown beside it. Build order approved: PR 1 here, then #329's PR 2 and PR 3, then PR 2 (the line) and PR 3 (Tidy).

2026-11-14, later: **PR 1 built** (v2.7276, migration `20261114100000_box_name_rule.sql`, `docs/recent-features/v2.7276.md`). The kernel `boxName.ts`; both Add screens open on the site's next free name with *How it sits* remembered; words typed after a name ride the where line until PR 2; Edit holds the same rule; the trigger, the carry's renumber and the seat hold it in the database; `compareLabels` already sorted `G24B` as read. A lettered twin counts its number: when `G24B` stands the next is `G25`, and `G24` is never offered, since one past the highest is the rule. The stickers card's call 7 is amended.

2026-11-15: **PR 2 built** (v2.7348, migration `20261115210000_box_line.sql`, `docs/recent-features/v2.7348.md`), on Taunya's word of the same day to carry on once #329's PRs 2 and 3 had merged (v2.7272, v2.7298). The column `job_containers.description`; the kernel `boxLine.ts`, shared with `box-read`; the line on the box's screen with **Say it better**, on the phone's list and search, the office card, Go anywhere, the scanned page and the Print labels chips; a **What is in it** field on both Add screens, the sticker sheet and Edit, where words typed into a name now land. Where the mock-up left a choice: a mixed box names the two parts it holds most of, and a person's line reads *In a person's words* with no name or day, since the one column keeps neither.

**Stop: add ten boxes on a real site.** This is the card's own next step and it is a person's, not a session's. Add ten boxes on a real site and read each one's line. Does the app's line say what a person would call the box? Are two names enough for a mixed one? Does anyone press Say it better? PR 3 (Tidy the names) and PR 4 (the line on a loose pile's label, call 4) wait for those answers.
