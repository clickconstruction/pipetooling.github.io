---
name: "State roll: who holds a license near us"
number: 411
group: ready
status: Go 2026-11-21 · Taunya said build it as drawn · branch worktree-state-roll · step one under way
summary: >
  Taunya cannot find experienced plumbers, and they must be licensed. The state publishes the roll
  of every licensed plumber as free files, and of every electrician and A/C license on its open
  list. A new State roll tab on Prospects keeps the roll for our counties, checks our own people
  and subs against it, and leads with a few names a week: the newly licensed, a journeyman who
  just made master, a long-held license that lapsed. Each name gives its reasons as tags and there
  is no score. The state gives no phone, address or email, so how to reach a person is added by
  the office by hand.
next: >
  Step one, the tables and the weekly pull for plumbing. Then Our own, which contacts nobody.
size: L as a train of five (M · M · M · M · S)
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
- **The app's note was wrong.** `check_license` and the logbook's check refuse a plumbing number, saying the board keeps no open list. It does.

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

## The train, step by step

One change a PR. A migration merges alone and is pushed before the code that calls it.

1. **The tables and the pull.** `license_roll` (one row a license), `license_roll_changes` (what a pull saw change, growing only), `license_roll_pulls` (the ledger), `license_roll_counties` and `license_roll_left_off`. Then `license-roll-pull`, a function on a Monday cron that reads the plumbing files, keeps our counties, honours Leave off and writes what changed. The Pulls view.
2. **Our own.** The match of our people's and subs' numbers against the state. `check_license` reads a plumbing number.
3. **Everyone and the person's sheet.** Search, the line of history, notes, Leave off.
4. **Call this week.** The tags, the order, Pursue to Hiring, Not for us, the Reach block.
5. **Electrical and A/C.** The same four views over TDLR's open list.

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

## Still Taunya's to say

- Whether apprentices are ever turned on.
- Whether the list goes past the five counties.
- Whether a Monday note carries the list, as Market's would.
