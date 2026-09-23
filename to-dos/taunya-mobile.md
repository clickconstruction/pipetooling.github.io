---
name: Taunya on a phone
number: 30
group: ready
status: audited 2026-09-22 · thirteen surfaces captured at 375 px as the sample assistant · before/after drawn for each · PR 1 (the shell) shipped 2026-09-23 as v2.3749 · PR 2 redrawn against the code (`taunya-mobile-pr2-pipeline.html`), five calls taken 2026-09-23 · PR 2a (the Pipeline) v2.3762 · PR 2b (the window's bar) built as v2.3779
summary: >
  The assistant's surfaces, ranked by Taunya's own page-minutes (189 h over 90 days), each
  looked at on a phone and rated; a first proposal and a second "is this the best we can do"
  pass for every one, drawn side by side; two bugs the capture found; a five-PR order.
next: PR 3 — Quickfill as a round (#4): a list of 27 rows (name · count · age), a section is a screen, Mark looked · next section at the thumb.
size: L
blocker: none
mockup: to-dos/taunya-mobile-before-after.html
ver: v2.3737 · v2.3738 · v2.3749 · v2.3762 · v2.3779
---

# Taunya on a phone: the assistant's surfaces, rated and redrawn

**The ask (2026-09-22):** "figure out all the surfaces assistant Taunya touches and then look at
those surfaces on mobile and create a list of how easy or difficult they are to use … propose
visual changes for the mobile view … make a pass on each asking ourselves, is this the best we can
do? and present me with the before and after."

**The mock-up:** `to-dos/taunya-mobile-before-after.html` — one section per surface with three
phones: *Before* (drawn from the capture, real counts), *After* (first proposal), *Is this the best
we can do?* (the second pass). Published copy with the real screenshots beside it:
https://claude.ai/artifact/TcRMZxQw91z3AbNeFYFLnD (private; share from its menu).

## How the list was made

The app records page-minutes per person (`user_app_activity_page_daily`, key = first path
segment + `?tab=`; People → Activity → *Day-by-day activity for Taunya*, 90 days). Taunya:
188 h 50 m over 45 page keys. Everything with an hour or more is on the list, plus the shell
every page sits in and the job window the pipeline opens into.

| # | Surface | Taunya · 90 d | On a phone | The measured problem |
|---|---|---|---|---|
| 0 | The shell (header, menus, dock) | every page | hard | Pages in four menus; the dock's five slots carry 32 of her 189 h; a deep link opened after 5 min away bounces to the schedule |
| 1 | Jobs · Pipeline | 64 h 15 m | hard | List starts 2,600 px down under the map and six money cards; ~600 px per job card; the one big button per card advances the status |
| 2 | Dashboard | 31 h 34 m | hard | 6,083 px; Clock In + empty My Schedule take screen one; Needs You at ~1,000 px; a 613 px table |
| 3 | Schedule hub · Day | 30 h 08 m | hard | 4,200 px roster, every account incl. Free, office first, sample/twin accounts listed; block tap opens the clock modal |
| 4 | Quickfill | 22 h 33 m | unusable | 27 sections open: 28,692 px, 567 controls, 30 inputs < 16 px, one table 4,069 px wide |
| 5 | Materials · Supply houses | 9 h 51 m | ok | Cards fine; two AP tables at 493 px / 10 columns scroll sideways |
| 6 | Estimates | 4 h 23 m | easy | Fits; "▶ —" expander unlabeled |
| 7 | Prospects · Follow Up | 4 h 04 m | easy | Built for a thumb; tab strip wraps |
| 8 | Dispatch Mode · Schedule | 3 h 24 m | easy | The best phone screen in the app; the model |
| 9 | Jobs · Subs · Pay | 2 h 21 m | hard | 980 px, 9-column table; job column wraps to 7 lines; Open column off screen |
| 10 | People · Hours | 1 h 21 m | hard | 996 px, 30-column grid; clocked-in table clips Job; Approvals modal is right |
| 11 | Customers | 1 h 03 m | unusable | 444 cards at once: 67,927 px, 3,370 targets; search on screen three |
| 12 | Jobs · Subs · Work | 1 h 02 m | ok | ~500 px per sheet card; readable, slow |
| 13 | The job window | 452 opens / 60 d | ok | Tabs sticky; status, bill, note sit 1,400 px down under Arrived / Leaving |

Below an hour (not on the list): People · Vehicles 0:48, Bid Board 0:45, Documents 0:37, AR
0:36, Bids · Pricing 0:32, Tally 0:23, and 29 more under 20 minutes.

**Caveat:** page minutes carry no device. Her evening and weekend minutes and her three
phone-specific reports (dispatch drag v2.2736, Follow Up, supply-house notes) are the evidence
she works from a phone; the shell changes assume it.

## The capture

Every surface at 375 × 812 (iPhone UA, touch, DPR 2), signed in as
`sample-assistant@samples.pipetooling.local` through dev-login — the sample account sees exactly
what an assistant sees. Screenshots first screen + full page, plus a metrics line per surface
(page height, targets under 36 px, text under 12 px, inputs under 16 px, elements past the right
edge, tables). `scripts/mobile-surface-shots.mjs` reruns it; the numbers in the mock-up's
captions are the ones to beat after each PR.

## Two bugs, not design

1. **Deep links bounce to the schedule.** ~~Dispatch Mode's "back after 5 minutes → Schedule" jump
   (`Layout.tsx`, `isDispatchModeReturnAfterAway`) has no home-path guard; the newer one-hour rule
   (`assistantDispatchLanding.ts`) fires only from `/` and `/dashboard`. Opening
   `/jobs?tab=stages` cold as a phone assistant landed on `/dispatch-mode/schedule` in two of
   three runs. Two rules, two thresholds, one missing guard → one rule.~~ **Fixed in v2.3738**
   (2026-09-22): one rule in `assistantDispatchLanding.ts` — 5 minutes with Dispatch Mode on,
   1 hour on a phone otherwise, both only from `/` or `/dashboard`; the Layout listener is gone.
2. ~~**The schedule hub's Day roster lists the sample and twin accounts**~~ — **fixed in v2.3737**
   (2026-09-22). "Sample leader", "Twin Estimator 1", "Sample assistant" showed to a real dev and
   to the assistant alike (verified 2026-09-22 as Robert): the People rosters filter `is_sample`
   and `is_digital_twin`; the hub's loader did not. It now runs the same active-roster query and
   kernel, which also fixes Dispatch Mode → Schedule, Quick assign and Quickfill Schedule.

## The second pass, in one line each

- **Shell** — the role default picks four dock slots, long-press swaps one, one *More* sheet
  replaces hamburger + modes menu + gear on phones; the two return rules become one.
- **Pipeline** — a stage picker and search stay sticky, a job is two lines with its one red or
  amber chip, *Needs me* filters to those, swipe-right advances with a confirm sheet that
  states the money and schedule consequence; the map and money cards fold to an Overview.
- **Dashboard / Inbox** — Needs You is a deck (Deck / List / Done, the Follow-ups rhythm) on the
  Inbox tab; the dashboard drops the duplicate, the clock row is one line for office roles, empty
  sections hide.
- **Schedule hub Day** — crews first, Office and Free behind chips, samples filtered; a block
  tap opens the block's sheet (Move · Reassign · Note · Open job), the clock modal moves behind
  the name.
- **Quickfill** — a list of 27 rows (name · count · age), a section is a screen, *Mark looked ·
  next section* at the thumb; the round ends when the top of the list is green.
- **Supply houses** — the house card carries the balance, aging bar and Call / Email; the house
  screen is the thing she holds during the call, with a notepad that saves to the house.
- **Subs Pay / Work** — subs as rows with the open dollars, one bottom sheet with Set a window ·
  Get it in writing · Record payment; nine identical buttons become one *Get all 9 in writing*.
- **People · Hours** — three phone views (Who's in · Approvals · Sessions); the grid becomes a
  person screen: this session, the week around it, Approve on it.
- **Customers** — the phone's Customers is the search (keyboard up, matches carry Call / Email,
  jobs match too), recents under it, *Everyone A–Z* behind a chip.
- **Job window** — a sticky bar (Status ▾ · the job's next verb · Note); Arrived / Leaving only
  for people on the crew.

## PR order

| PR | What | Surfaces | Size |
|---|---|---|---|
| 1 | ~~Shell: role dock + long-press swap, one More sheet, one return rule with the guard~~ **shipped v2.3749** (the rule v2.3738, the hub roster v2.3737) | #0, bug 1 | M |
| 2 | Pipeline on a phone + the job window's action bar — redrawn against the code 2026-09-23 (`taunya-mobile-pr2-pipeline.html`, the kernel table and the five calls); **2a the Pipeline shipped v2.3762, 2b the window's bar v2.3779** | #1, #13 | L |
| 3 | Quickfill as a round | #4 | M |
| 4 | Needs You deck on Inbox, office-order dashboard, crews-first Day with the block sheet | #2, #3 | L |
| 5+ | Rows-not-tables: Subs Pay/Work, Supply houses, People · Hours, Customers | #5, #9–12 | M each |

Each PR ships its release note, its `docs/recent-features/` fragment and a help-guide touch
where a flow changes; PR 1 also amends `docs/twins/APP_DIRECTORY.md` (the phone dock) and
`ACCESS_CONTROL.md` is untouched (no permission changes).

## Where it stands (2026-09-22)

- The audit, the mock-up and the capture script merged through PR #3588. **Another session builds
  it** — this file and the mock-up are the hand-off; nothing else was written down anywhere.
- The two bugs were started the same day in their own sessions (task chips from the audit
  session): *Guard Dispatch Mode's 5-minute return jump* and *Hide sample and twin accounts from
  the schedule hub*. Check `git log origin/main` for their versions before touching PR 1's
  bug half; if they merged, PR 1 is the dock, the More sheet and the sticky page tabs only.
- ~~Open owner call: the assistant dock's four slots~~ — taken 2026-09-23: Jobs · Schedule · Quickfill ·
  Inbox with More as the fifth, assistants only, tied to Dispatch Mode; shipped v2.3749.
- Design rules the second pass settled, for whoever builds: no live status button on a card
  on a touch screen (swipe + confirm sheet instead); a table becomes rows with one number per
  row and a bottom sheet for the row's actions; a phone view says plainly when a matrix
  (hours grid, week) opens on a desktop; every input 16 px; a page's own tab strip is sticky
  under a slim header because the app header scrolls away.

### The numbers to beat (375 × 812, sample assistant, 2026-09-22)

| Surface | URL | Page px | Targets | Small (<36 px) | Text <12 px | Inputs <16 px | Past right edge | Tables |
|---|---|---|---|---|---|---|---|---|
| Dispatch Mode · Schedule (the dock's Schedule) | `/dispatch-mode/schedule` | 4,200 | 155 | 93 | 43 | 0 | 6 | — |
| Dashboard | `/dashboard` | 6,083 | 123 | 99 | 46 | 0 | 46 | 613 px × 8 col, 357 px × 4 col |
| Jobs · Pipeline | `/jobs?tab=stages` | 3,182 | 94 | 57 | 36 | 1 | 16 | — |
| Quickfill | `/quickfill` | 28,692 | 567 | 458 | 239 | 30 | 231 | 525 px × 8 col, 309 px × 4 col, 322 px × 8 col, 493 px × 10 col, 380 px × 3 col |
| Materials · Supply houses | `/materials?tab=supply-houses` | 7,457 | 120 | 46 | 20 | 3 | 81 | 493 px × 10 col |
| Estimates | `/estimates` | 6,467 | 172 | 129 | 12 | 1 | 0 | — |
| Prospects · Follow Up | `/prospects?tab=follow-up` | 2,026 | 50 | 32 | 7 | 2 | 0 | — |
| Dispatch Mode home | `/dispatch-mode` | 1,168 | 27 | 9 | 11 | 0 | 0 | — |
| Jobs · Subs · Pay | `/jobs?tab=subs&view=pay` | 3,563 | 127 | 99 | 89 | 1 | 388 | 980 px × 9 col |
| Jobs · Subs · Work | `/jobs?tab=subs` | 3,908 | 86 | 66 | 116 | 1 | 6 | — |
| People · Hours | `/people?tab=hours` | 4,056 | 298 | 153 | 66 | 9 | 488 | 530 px × 8 col, 328 px × 4 col, 996 px × 30 col |
| Customers | `/customers` | 67,927 | 3370 | 3358 | 2941 | 0 | 0 | — |

`scripts/mobile-surface-shots.mjs --out <dir>` regenerates the row set; "Past right edge" counts
elements whose box ends beyond 375 px, the sideways-scroll tell.

## Verify recipe

```bash
npx vite --port 5181 --strictPort &
node scripts/mobile-surface-shots.mjs --out /tmp/shots            # the thirteen surfaces
node scripts/mobile-surface-shots.mjs --out /tmp/shots /jobs?tab=stages   # one
```

Compare `metrics.json` against the captions in the mock-up; open the PNGs. Then the real
thing: Taunya's phone, the Pipeline, "move J1004 to Friday".
