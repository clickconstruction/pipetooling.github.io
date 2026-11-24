---
name: "State roll: who holds a license near us"
number: 411
group: ready
status: Go 2026-11-21 · Taunya said build it as drawn · step one built and live, v2.8159, v2.8164 and v2.8198 (the tab with its Pulls view) · step two built and live, v2.8202 (the read keeps our own licenses, redeployed and pulled), v2.8233 (the Our own view) and v2.8317 (`check_license` reads a plumbing number) · step three built, not merged, v2.8380 (the notes table and Leave off, PR #9511) and v2.8390 (Everyone and the person's sheet), approved by the owner 2026-11-23 · the Our own view not yet walked on the live site
summary: >
  Taunya cannot find experienced plumbers, and they must be licensed. The state publishes the roll
  of every licensed plumber as free files, and of every electrician and A/C license on its open
  list. A new State roll tab on Prospects keeps the roll for our counties, checks our own people
  and subs against it, and leads with a few names a week: the newly licensed, a journeyman who
  just made master, a long-held license that lapsed. Each name gives its reasons as tags and there
  is no score. The state gives no phone, address or email, so how to reach a person is added by
  the office by hand.
next: >
  Merge v2.8380 (PR #9511), push its migration, regenerate the types, then arm v2.8390 and walk Everyone and the sheet on the live site. Walk the Our own view too. Then step four: Call this week.
size: L as a train of five (M · M · M · M · S)
ver: v2.8159 · 8164 · 8198 · 8202 · 8233 · 8317 · 8380 · 8390
blocker: None. A lawyer's answer is wanted before the first call from the list, which is step four.
opinion: build — start with the pull and Our own, which are worth having with no outreach at all
---

# State roll: who holds a license near us

Mock-up: [`mockup.html`](./mockup.html). Every person, license number, company, phone and day on it is made up.

## The ask

Taunya, 2026-11-20, the day after Prospects → Permits → Market ([#405](../permits-market-page/README.md)) reached the live page:

> *"I'm having an issue finding experienced plumbers and I really need these plumbers to be licensed. And thankfully the state board carries the names of all the licensed plumbers and their apprentice details. I think that it wouldn't be unreasonable for us to use that as a way to find people who were recently licensed or to find people whose licenses have just expired. I think this means we need to collect the information of everybody who is licensed and then begin adding information to that."*

She asked for plumbing and electrical, and for A/C endorsements if they can be seen. On 2026-11-21, on the mock-up: *"Rather than file it, I think I want to build it … I'd like to put this all underneath a new tab."* Then: *"Yes, build it."*

## What the state publishes

Read from the sources on 2026-11-20. Nothing was written anywhere, and the sample was deleted.

| | Plumbing | Electrical and A/C |
|---|---|---|
| Who | Texas State Board of Plumbing Examiners | Texas Department of Licensing and Regulation |
| How | Six free CSV files at `tsbpe.texas.gov/free-licensee-list/`, said to be updated daily | The open list `data.texas.gov/resource/7358-krk7`, which `licenseText.ts` already reads one number at a time |
| A person's row | Rank, number, status (Current or Expired), license date, expiry, name, ZIP, county, endorsements | Type, subtype, number, name, expiry, county |
| Phone, street address, email | None | None |
| Recently licensed | Reads off the license date | No license date: only by keeping a pull and comparing the next |
| Just lapsed | Reads off the status and the expiry; a lapsed row stays about two years | Reads off the expiry; a lapsed row stays about 18 months |
| Employer, sponsor, hours, discipline | None | None |
| History | None kept | None kept |

- **The plumbing files.** Responsible master, master, tradesman and inspector are made on request at `/download-csv/{RMP|MP|TP|PI}/`. Journeyman and apprentice are zips under `/wp-content/uploads/2015/03/{JP|PA}.csv.zip`, and ran up to a week behind the other four.
- **The columns.** `RANK, LICENSE_NBR, LIC_STATUS, LICENSE_DATE, EXPIRATION_DTE, LAST_NAME, FIRST_NAME, MIDDLE_NAME, SUFFIX, ZIP, COUNTY`, then endorsements as Yes or No: `MEDGAS_ENDR`, `MRF_ENDR` (residential fire sprinkler) and `WS_ENDR` (water supply protection) on a journeyman or master, `TDC_ENDR` (drain cleaner) on a tradesman.
- **The responsible master file adds** a company, a business address and phone on about half its rows, and the day the insurance on file with the board ends. Those are the people who contract with the public: subs and competitors, not hires.
- **A step up shows in one pull, journeyman to master only.** The board lets a person hold both, so a new master row matches a journeyman row on name and ZIP. License numbers differ per rank.
- **A/C endorsements are visible.** A contractor's subtype gives class A or B with E (environmental air conditioning) or R (commercial refrigeration). A technician reads `REG` or `CER`. A plumbing license carries no A/C endorsement.
- **Why there is no phone.** Texas Government Code § 552.11765, in force since 2023-09-01, keeps a license holder's home address, home phone and email confidential. Name, number and status stay public. A records request would not get them.
- **Robots files.** `tsbpe.texas.gov` disallows only its admin folder. `tdlr.texas.gov` disallows its own CSV files, so a job reads the open-data copy, which asks for a second between requests.
- **The app's note was wrong.** `check_license` refused a plumbing number, saying the board keeps no open list. It does, and since [v2.8317](../../docs/recent-features/v2.8317.md) the verb reads it.

## The tab

A fourth pill on Prospects, beside Hiring and Permits, named **State roll**. People already has a Licenses tab for our own team, so the name says whose roll this is. Chips pick the trade and the counties. Four views:

1. **Call this week.** A few names, each with its reasons as tags and no score: *New journeyman*, *Master this month*, *Lapsed 5 months*, *Held 14 years*, *Medical gas*, *Worked here before*. **Pursue** makes a card on the Hiring board with the license filled in. **Not for us** takes the name off. **Leave off** is for a person who asks not to be listed, and the name never comes back on any pull. Every row carries a **Reach** block that reads *Nobody found a way yet* until the office adds a number.
2. **Everyone.** The kept roll for our counties, with a search box. A row opens the person's sheet: the state's facts, a line of history that starts on our first pull, and our notes.
3. **Our own.** Our teammates' licenses from People → Licenses and our subs', each beside what the state says: *Matches*, *The state has a later date* with **Use the state's date**, *Lapses in 23 days*, a sub's *Insurance ends in 11 days*. Nobody is contacted.
4. **Pulls.** When each state file was last read, how many rows were kept and what changed.

## What is settled

Taunya's go of 2026-11-21 was to build it as drawn. The drawing's choices stand until she changes one.

- **Who sees it:** the people who hold the Hiring switch (`user_has_team_prospects_access()`), and nobody else. Our own follows People → Licenses' audience.
- **Trades:** plumbing first. Electrical and A/C are the last step, turned on by trade.
- **Counties:** the five the permits cover: Bexar, Travis, Hays, Comal and Guadalupe. A county can be added on the page.
- **Apprentices: off.** The state's file gives no age, and an apprentice can be 16. The pull reads the apprentice file only to check a teammate's own number, and keeps no other row of it.
- **A lapse waits three months before the list shows it.** Most people who lapse renew late.
- **Nobody is looked up.** The app never searches for a person's phone or address. A number is one a person here adds.
- **No text without a yes.** *OK to text* starts as *Not asked*, the rule Prospects already keeps.
- **A name match stays grey until a person checks it**, the way a looked-up fact does on Market.

## Where it stands

Read on prod on 2026-11-21 and 2026-11-22, by counts only.

- **The tables are on prod** ([v2.8159](../../docs/recent-features/v2.8159.md), migration `20261121140000`): five tables with row security and the four fences, the gate closed to `anon`, the five counties seeded.
- **The pull is deployed and scheduled** ([v2.8164](../../docs/recent-features/v2.8164.md), migration `20261121141000`): `license-roll-pull` answers, refuses an unsigned caller, and has four Monday jobs. A fifth came with v2.8202.
- **The first pull is in.** Four files read, 6,507 rows kept, none skipped and none outside our counties. Every row has its `first_seen` line. A second pass over the same files added, changed and dropped nothing.
- **Seen on the way:** about half the responsible master rows carry no ZIP, since that file's ZIP belongs to a business address the board fills only sometimes. They are kept by county. It matters in step four, where a master is matched to their journeyman row by name and ZIP.
- **The tab is live** ([v2.8198](../../docs/recent-features/v2.8198.md)): Prospects → State roll, for the Hiring switch alone, with the Pulls view. It names no person yet.
- **The read for our own people is running** ([v2.8202](../../docs/recent-features/v2.8202.md)): its fifth Monday job is on prod (migration `20261121210000`), and `license-roll-pull` was redeployed on Taunya's go on 2026-11-21. A dry run of all five files came back clean, and the pull after it marked our own rows and kept our apprentices' and nobody else's from the apprentice file.
- **The Our own view is live** ([v2.8233](../../docs/recent-features/v2.8233.md)): each plumbing license we hold beside the state's row of the same number and rank, with **Use the state's date**. It is drawn for a person who may also open People → Licenses. It merged at 05:09 UTC on 2026-11-22 and reached the site with the Pages deploy of 05:23 UTC.
- **Seen on the way:** People → Licenses often holds a first name alone, or a short form with a last initial. The check that the state's name is ours takes those, or every line read *Another name*.
- **The dev seat reads the new tables.** `dev-mcp`'s deploy from main at 01:51 UTC on 2026-11-22 carried the regenerated catalog, and `find_table` and `read_rows` answer for all five.

## Left to do and to walk (2026-11-22)

For whoever picks this up next. Nothing here is open in a pull request: every change above is merged, pushed and deployed.

### Walks still owed

Each walk is on the live site, `clicktooling.com`. The dev seat signs in to the browser pane with `node scripts/dev-pane-login.mjs`. Another role is walked through Settings → View as. Press nothing that writes on a real person's row unless the walk says so.

1. **Our own, as a dev.** Path `/prospects?tab=roll&roll=own`, at 1100 px and 375 px, in light and in dark.
   - Should see: the strip **Our own** · **Pulls** with Our own lit, a line that counts the licenses of other trades not checked, and two chips, **Needs a look** and **Matches**, each with its count. The view opens on Needs a look when any license needs one.
   - Each card: the person's name, *Teammate*, a coloured pill, then **We hold**, **Our date** (underlined, a press), **The state says** and **Listed as**. A card whose date differs from the state's has **Use the state's date**.
   - Two cards across at 1100 px, one at 375 px, no sideways scroll. The red, amber and green pills read in dark.
   - On 2026-11-21 the live rows gave cards of four kinds: *Matches*, *The state has a later date*, *Lapsed* and *Not on the roll*. None read *Another name* after the name fix.
   - Why not walked: it was looked at on the dev server only, at both widths, in light only, before it merged. Nobody has opened it on the live site or in dark.
2. **Use the state's date, and Our date typed in place.** Same path, as whoever keeps the office's licenses.
   - Should see: the press saves, a toast says *the date is now* with the day, the card moves to Matches, and People → Licenses shows the same date. A note goes to Dispatch only if the new date lapses soon.
   - Why not walked: every card it can be pressed on is a real person's license. A `ZZ Test` license cannot reach it, since a made-up name reads *Another name* and offers no date. It waits on Taunya's go to press it on a real row. Those presses are the fixes the office would make anyway.
3. **Our own is closed to a person who cannot open People → Licenses.** View as an estimator who holds the Hiring switch. Paths `/prospects?tab=roll` and `/prospects?tab=roll&roll=own`, at 375 px and 1100 px.
   - Should see: the Pulls view alone, with no strip, on both paths.
   - Then View as a pay-approved master technician who holds the switch. Should see the strip and Our own, as in walk 1.
   - Why not walked: the render test covers it, and no walk has been done as either role.
4. **The tab is closed to a person without the Hiring switch.** View as any office role that lacks the switch. Path `/prospects?tab=roll`.
   - Should see: no **State roll** pill, and the address lands on the calling deck.
   - Why not walked: never walked as such a role since v2.8198.
5. **The Pulls view after Monday's run.** As a dev, `/prospects?tab=roll&roll=pulls`, at 375 px and in dark.
   - Should see: four cards showing Monday's read, the four counts at the top, and no red words on a card.
   - Why not walked: the jobs first run on Monday 2026-11-23, and the view has not been opened at 375 px or in dark on the live site.
6. **The guide.** `/help/see-the-state-roll-of-licensed-plumbers`, at 375 px, light and dark. Should see the new section *Check our own licenses* with its example card and coloured chips. Why not walked: it shipped with #9312 and has not been opened on the live site.

### The first scheduled pull

The five Monday jobs run for the first time on Monday 2026-11-23, at 12:30, 12:35, 12:40, 12:45 and 12:50 UTC, which is 6:30 to 6:50 in the morning in Texas. Every pull so far was pressed by hand.

After they run, check by counts:

- `cron.job_run_details` shows all five jobs `license-roll-pull-rmp`, `-mp`, `-jp`, `-tp` and `-pa` succeeded.
- `license_roll_pulls` has five new rows, each with `finished_at` set and `error` empty.
- The four weekly files keep about what they kept on 2026-11-21: 1,228 responsible masters, 597 masters, 4,010 journeymen and 672 tradesmen. A refusal that says a file *looks cut short* means the board sent a partial file, and nothing was changed.
- The apprentice file keeps our own apprentices' rows and no other.

**Read on 2026-11-23 at 12:53 UTC, counts only, off `license_roll_pulls` through the dev seat.** All five jobs ran at their minute and each wrote one row with `finished_at` set, `error` empty and no `pulled_by`: responsible masters 9,416 seen and 1,228 kept with 5 changed, masters 4,365 and 597 with 1 changed, journeymen 26,474 and 4,010 with none, tradesmen 3,580 and 672 with 1 changed, apprentices 43,076 seen and 3 kept with none. Nothing was added and nothing went. The four weekly files kept what they kept on 2026-11-21, and the apprentice file kept our own three rows and no other. `cron.job_run_details` was not read: the seat does not open the cron schema, and the five rows stand for the five jobs.
- The journeyman and apprentice zips can run up to a week behind the other files, so a quiet week for them is normal.

### Loose ends

- **`check_license` on the dev seat reads a plumbing number** ([v2.8317](../../docs/recent-features/v2.8317.md)). It fetches the board's file of the level and answers by number, with no ZIP, county, address or phone, and keeps nothing. This closes step two. The edit window on People → Licenses still offers the board's search: a page cannot read a file that is the whole state at one level, and Our own already shows each license beside the state's row.
- **No sub shows on Our own.** No person record holds a license today. The view reads one and tags a sub's when it does. The drawing's Teammates and Subs chips wait for the first.
- **The apprentice file is not on Pull 4 files.** It is read on its Monday job only, so a new apprentice's license reads *Not on the roll* until then.
- **Our date on a card is 28 px tall on a phone.** It is the app's shared in-place field (`ChangeableValue`), so it was left as it is. Every other press on the view is 44 px.
- **Leave off is written by the sheet** since step three ([v2.8380](../../docs/recent-features/v2.8380.md) and [v2.8390](../../docs/recent-features/v2.8390.md)), once both are merged and the migration is pushed. Until then nobody can add to `license_roll_left_off`.
- **The cards that need a look are real.** Some licenses read *The state has a later date*, *Lapsed* or *Not on the roll*. A license *Not on the roll* may be a number typed wrong, or one the state's file no longer lists. These are the office's to check on People → Licenses, not code.
- **Steps four and five are not built.** Four: Call this week, with its tags, Pursue to Hiring, Not for us and the Reach block. Five: electrical and A/C over TDLR's open list, where an A/C contractor's class and endorsement and a technician's `REG` or `CER` are visible.

### Taunya's to say

- Whether to press **Use the state's date** on the real cards, or have the office fix them on People → Licenses. Walk 2 waits on this.
- A lawyer's answer before the first call from the list, which is step four. The questions are under [Before anyone is called](#before-anyone-is-called).
- Whether apprentices are ever turned on.
- Whether the list goes past the five counties.
- Whether a Monday note carries the list, as Market's would.

## The train, step by step

One change a PR. A migration merges alone and is pushed before the code that calls it.

1. **The tables and the pull.** `license_roll` (one row a license), `license_roll_changes` (what a pull saw change, growing only), `license_roll_pulls` (the ledger), `license_roll_counties` and `license_roll_left_off`. Then `license-roll-pull`, a function on a Monday cron that reads the plumbing files, keeps our counties, honours Leave off and writes what changed. **Built, v2.8159 and v2.8164**, and the first pull is in. The Pulls view shipped with the tab, v2.8198.
2. **Our own.** The match of our people's and subs' numbers against the state. `check_license` reads a plumbing number. **Built, v2.8202, v2.8233 and v2.8317**: the pull keeps a row whose number is ours whatever the county, and reads the apprentice file for our own apprentices alone. The Our own view lays each license beside its state row. The dev seat's `check_license` reads a plumbing number off the board's files. What is left is under [Left to do and to walk](#left-to-do-and-to-walk-2026-11-22).
3. **Everyone and the person's sheet.** Search, the line of history, notes, Leave off. **Built, not merged, v2.8380 and v2.8390**, the owner's go of 2026-11-23. See [Step three, as built](#step-three-as-built-2026-11-23).
4. **Call this week.** The tags, the order, Pursue to Hiring, Not for us, the Reach block.
5. **Electrical and A/C.** The same four views over TDLR's open list.

## Step three, as built (2026-11-23)

Two PRs, neither armed when this was written. Every name in their tests and looks is made up.

- **v2.8380, the migration** (PR #9511, `20261123185500_license_roll_notes`). `license_roll_notes` holds our notes, kept by the license's number and by name and ZIP, so a note outlives the roll row and follows a new rank. A trigger stamps the author and the time. `license_roll_leave_off()` writes the left-off row and takes the person's rows off at once, by number and by name and ZIP. It refuses a person who holds one of our own licenses. `license_roll_left_off` gains `shown_as`, `noted_by_name` and a delete for Put back. A new SQL bed covers it.
- **v2.8390, the client**, stacked on v2.8380. The Everyone view between Our own and Pulls: a search box, the seven chips, the six columns on a desk and two lines a person on a phone, fifty rows a page. A row opens the person's sheet, kept on the address as `person=<id>`. The sheet has the state's facts, **What changed, as we saw it**, **Our notes**, **Add a note**, **Delete** on one's own note and **Leave off**. Leave off asks first with a press that names the person, and the toast after it offers **Put back**. At the foot of Everyone, **Left off at their asking** lists each with **Put back on the list**. Guide `look-up-a-licensed-plumber-on-the-state-roll`.
- **Who reads and writes notes, as built.** Everyone who holds the Hiring switch (`user_can_read_license_roll()`) reads every note and writes one as themself. Only the author deletes a note. Nobody edits one. A training account, a digital twin and an archived account read and write nothing new. Leave off and Put back are open to the same people, with the same refusals.
- **Who sees Everyone.** Every Hiring holder. Each now has a strip with Everyone and Pulls and opens on Everyone. A person who may also open People → Licenses keeps Our own first, and alone sees the **One of ours** tag.
- **Not drawn, on purpose.** The Reach block, a cell and OK to text, is step four and waits on a lawyer's answer. The Ours column draws no *On Hiring*, *Not for us* or *New this week*: those belong to step four's list.

### Left for step three

1. **The parent's steps after v2.8380 merges.** `supabase db push`, a types PR for `src/types/database.ts`, and a `dev-mcp` deploy if its catalog moves. Then arm v2.8390.
2. **A walk on the live site** once v2.8390 is deployed, as a Hiring holder at 375 px and 1100 px, light and dark. Search a name, light each chip, open a sheet, read its history. Press nothing that writes on a real person's row. A note and Leave off are walked on a row only with Taunya's go, since every row is a real person.
3. **The walk as a holder without People → Licenses.** The strip should show Everyone and Pulls, and no row should say One of ours.
4. **Has our notes counts every note's number.** A note on a person who is now left off still counts on the chip until they come back. It is a small count, read in one go, and fine at the size the office will write.

## What bites here

- **The roll is real people, and this repo and the to-do pages are public.** No real name, license number, address or phone in a test, a fixture, a doc, a card, a PR or a screenshot. Invented ones only. Counts of the company's own people stay out too.
- **A lapse is not a sign a person is looking.** They may have retired, moved or renewed late. The row says so.
- **A person is more than one row.** A journeyman who makes master holds both. Rows join on name and ZIP, and about three keys in a thousand are shared by two rows, so a join is shown as a match to check, never as a fact.
- **Leave off must outlive a new number.** It is kept by number and by name with ZIP, so a new rank does not bring the person back.
- **The state keeps no history.** What changed is known only from the day of our first pull.
- **TDLR gives no license date.** *New on the roll* there means the name was absent on our last pull, so it works from the second pull.
- **The plumbing board's license search asks for a robot check.** Nothing reads it. The files need none.
- **The preview reads the live database.** Check read-only. Press nothing that writes on a real row.

## Before anyone is called

Not legal advice, and a lawyer's answer is wanted before step four ships a list people call from.

- An autodialled or prerecorded call or text to a cell needs prior consent, recruiting included.
- Texas law defines a solicitation as inducing a person to buy or receive an item, and counts a text as a call. A job offer is not a sale as worded. Whether it is covered is a lawyer's to say.
- Whether a sub agreement bars hiring that sub's plumbers.
