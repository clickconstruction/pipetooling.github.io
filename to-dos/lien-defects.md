---
name: "Lien screens: defects found while listing every action"
number: 83
group: ready
status: found 2026-10-05 by reading the code · none confirmed by running the app · none fixed
summary: >
  Listing every action on the lien screens for #82 turned up defects that are in the app today.
  Six can affect paper or money: the Unconditional warning is skipped by three routes, a saved
  copy link typed while recording may not save, the office's letter edits may be overwritten
  when the leader approves a GC run, printing from the Put a GC on notice run does not mark the
  notices printed, the 7 day check wait is missing on two doors, and the Dashboard queue always
  opens Unconditional · progress. The rest are dead or misdirected links, states with no way
  forward, and stale guides. Each row names its file and line.
next: Confirm the six under "Paper and money" by running each one on a ZZ TEST job, then fix them one PR each.
size: M in all (about fifteen XS and S fixes)
blocker: None.
opinion: build — confirm before fixing; every row was read from code and two say "needs confirming".
mockup: not required — fixes to behaviour that exists, no new screen
---

# Lien screens: defects found while listing every action

## The ask

The owner, 2026-10-05, after reading the list: *"What you've proposed and the defects are probably better, please save it all to the punch list so someone else can come by and fix the defects and build all of it."*

The proposal is #82, [`lien-desk-next-up/`](lien-desk-next-up/README.md). Its five inventory files hold the evidence for every row here, under each file's *Easy to miss* heading.

## How sure this is

Every row was found by reading the code on 2026-10-05, main at v2.4545. **None was run.** Line numbers drift, so search for the label when a line does not match. Confirm a row before fixing it, and strike it here in the same PR.

File names without a path are in `src/components/jobs/`.

## Paper and money

| # | Where | What is wrong | Evidence | Fix |
|---|---|---|---|---|
| 1 | Release of Lien | The "Are you sure you meant to choose Unconditional?" warning fires only from the step 2 switch. Three routes skip it: *Waive the $X already paid instead ›* and *Waive the $X paid ›*, *Issue unconditional* from the strip or the Dashboard queue, and a settled bill that picks unconditional by itself. | `LienReleaseModal.tsx:1200-1205` (fires), `:1030-1035`, `:414` | Owner call first: should a preset or automatic Unconditional ask too? The warning was written for a person choosing it. If yes, route all four through `pickUnconditional`. |
| 2 | Job's Lien window, record steps | The *Saved copy* link and note typed while recording a notice, a filing or a release may not be saved. `insertFiling` and `recordNoticeSends` read `docUrl` and `docNote` inside `useCallback`s whose dependency lists leave them out. Adding the link later from the Filings list works. | `LienFilingTabs.tsx:329-355`, `:385-430` | Add the two values to the dependency lists. Add a render test that types a link, records, and reads the insert. |
| 3 | Put a GC on notice | After *Send all N to the leader*, the office's letter edits, reason, note and ticks look to be overwritten when the leader presses Approve all. They are local state seeded from defaults on every open, and the drafts are saved again from his window's values. | `GcOnNoticeModal.tsx:216-226`, `:310-320`, `:461-489`; `src/lib/jobs/gcOnNotice.ts:168-175` | Seed the window from the saved drafts when they exist. Needs confirming first. |
| 4 | Put a GC on notice, the run | Printing from this window's run does not stamp the notices printed, so they never reach *In the mail · tracking owed*. The Lien desk passes `onPrinted` to the run and this window does not. | `GcOnNoticeModal.tsx:1214-1227` against `LienDeskRunModal.tsx:43-44`, `:151` | Pass the same `onPrinted`. |
| 5 | Releases | The 7 day wait after a check is applied on the Bill tab, View bill and GC Review. It is not applied on the Bill Customer strip's *Issue unconditional* or the Dashboard queue, which count a release as cleared once applied payments reach its amount. | `src/lib/jobs/checkClearing.ts:13`, `:31-42`; `lienWaiverCell.ts:88`; `lienReleaseTracking.ts:64-80` | Read the same clearing rule in `lienReleaseTracking.ts`. |
| 6 | Dashboard release queue | It always opens *Unconditional · progress*, and its chip is fixed to *Conditional · progress*, even when the conditional was a final. The strip maps a conditional final to unconditional final. | `DashboardLienReleaseQueueModal.tsx:304`, `:372`; `BillCustomerLienReleaseStrip.tsx:217` | Use the strip's mapping. |
| 7 | Dashboard release queue | A row disappears as soon as any live unconditional row exists on or after the conditional, an autosaved draft included. | `lienReleaseTracking.ts:113-130` (no status filter) | Count issued or signed rows only. |

## Links that go nowhere, or to the wrong place

| # | Where | What is wrong | Evidence | Fix |
|---|---|---|---|---|
| 8 | Dashboard, lien card | *letter two ›* is drawn as a link and has no handler. A click does nothing. | `src/lib/dashboardNeedsYou.ts:617`, `:635`; `DashboardPinnedQuickRow.tsx:842-857` | Open the desk on the Sent pile. Needs row 9. |
| 9 | Dashboard and Quickfill, "mailed notice has no tracking number" | Both send `liendeskPile=sent`. The parser honours `missed` only, so the link lands on plain Notices. | `src/lib/jobs/stagesDeepLinks.ts:56`; `DashboardPinnedQuickRow.tsx:818`; `QuickfillNeedsYouSection.tsx:220` | Parse every pile name. The tracking card should name `printed`. |
| 10 | Dashboard, "A filed lien has not been served" and "demand-letter deadline passed" | Both land on the bare Pipeline with no window open. | `dashboardNeedsYou.ts:579-592`; `DashboardPinnedQuickRow.tsx:819-820` | Open the job's Lien window on the right tab. No URL opens that window today, so this needs a new parameter. |
| 11 | Payment forecast, *Send notice…* | Its tooltip names the Lien instruments window. It opens the Lien desk on that job. | `ForecastWorkMonthsPanel.tsx:186-193`; `JobsStagesTab.tsx:4302-4307` | Fix the tooltip. |
| 12 | Put a GC on notice, Step 2 | *Bill the finished work first ›* never shows. The host passes no handler. | `GcOnNoticeModal.tsx:118`, `:985` (`onOpenCapableList`); `JobsStagesTab.tsx` (the mount passes none) | Pass a handler that opens Bill Customer, or remove the link. |
| 13 | What customers see | *Open the Lien instruments →* opens the job, not the Lien window. | `src/lib/journeys/personJourney.ts:215-217` | Same new parameter as row 10. |
| 14 | Job's Lien window, Mechanic's lien | The text says each missing item "links back" to its fix. No links are drawn. | `LienFilingTabs.tsx:922` | Draw the links, or change the words. |

## States with no way forward

| # | Where | What is wrong | Evidence | Fix |
|---|---|---|---|---|
| 15 | Lien desk, *In the mail · tracking owed* rows | They have no footer. The footer has no branch for the `printed` pile. | `LienDeskModal.tsx:1641-1958` | A footer with the tracking editor's door and *Back to ready*. |
| 16 | Lien desk header | The run lists ready and printed notices and ready retainage. The header button and its count use ready only. With only printed notices left there is no way back into the run. | `LienDeskModal.tsx:2108-2111`, `:2226` | Count what the run lists. |
| 17 | Put a GC on notice, step bar | *The grid* never lights while scrolling. The scroll spy tracks four keys. | `GcOnNoticeModal.tsx:165` | Track the fifth. |
| 18 | Lien desk | A pile passed by a door is never cleared on the next plain open. | `LienDeskModal.tsx:266-268` | Clear it on open when no door names one. |
| 19 | Lien desk, Notices pane | A job switch does not clear the skip reason, the word channel, an open GC okay box, the counsel ask or the letter two menu. They can carry to the next job. | `LienDeskModal.tsx:482-496` | Clear them with the rest. |

## Words that disagree with the code

| # | Where | What is wrong | Evidence |
|---|---|---|---|
| 20 | Pipeline row, blue box | It counts drafts. Its tooltip says "issued". | `src/hooks/useStagesRowFlags.ts:122` |
| 21 | Put a GC on notice | The label reads *Also change, when the run is recorded*. The writes happen at Approve all. | `GcOnNoticeModal.tsx:500-539` |
| 22 | Legal desk | The header says *Settings → Jobs & dispatch*. The sheet and the guides say *Jobs & billing*. | `src/components/jobs/legal/LegalDeskModal.tsx:456` against `:591` |
| 23 | Legal desk, *Write down…* | It uses the first job's primary bill line. The guide says "largest open bill line". | `legal/LegalDeskModal.tsx:247-263` |
| 24 | Bill Customer strip | *View* shows the page without the signature, where every other View shows the stored ink. Its Void does not stamp `voided_by`. | `BillCustomerLienReleaseStrip.tsx` |
| 25 | Sub waiver | The dialog sends directly. The guide says it opens the Send for signature email. The settle guess is 5 days here and 7 on the GC side. | `src/content/help/send-a-lien-waiver.md:15` |
| 26 | Guide *give a customer a lien release* | Describes three forms and the buttons "✍ Request signature" and "Print for signature". The window has four forms and six steps. | `src/content/help/give-a-customer-a-lien-release.md` |
| 27 | Guide *file a lien and never miss its deadlines* | Describes a header line "⏱ Notice by … / File by …". The window draws the timeline strip. | `src/content/help/file-a-lien-and-never-miss-its-deadlines.md` |
| 28 | Guide *send lien notices from the Lien desk* | Describes dots under "Earlier months" that open a month's record. The months grid replaced them. | `src/content/help/send-lien-notices-from-the-lien-desk.md:127` |

A guide on `LEGACY_PLAIN_WORDS_GUIDES` must be rewritten in full when touched, and its row removed from that list.

## Dead code

- `openLienDesk(jobId)` on the tab's handle has no caller (`JobsStagesTab.tsx:352`, `:2325`).
- `LienDeskMonths` can draw a *Preview ›* link and a tail line. The desk passes neither (`LienDeskMonths.tsx:109-127`, `:161`).

## The plan

One PR per row, or per pair that shares a file. Suggested order:

1. Rows 2, 4 and 3: paper that is recorded wrong or lost. Row 3 needs confirming first.
2. Rows 5, 6 and 7: the unconditional release offered too early or in the wrong form.
3. Row 1, after the owner's call.
4. Rows 8 to 14: links. Rows 10 and 13 share one new link parameter in `src/lib/jobs/stagesDeepLinks.ts`.
5. Rows 15 to 19.
6. Rows 20 to 28: words and guides.

Each fix ships its release note and `docs/recent-features/` fragment. Strike the row here in the same PR, and delete this file when the last one is struck.

## How to verify

- Dev login on localhost: `/dev-login?as=1&to=/jobs?tab=stages&liendesk=1`. **This is a prod account on prod data.**
- Rows 2 to 7 write. Use a job on *ZZ TEST GC On Notice* (J1050, J1051, J1052), and void what the test records.
- Row 2: record a filing with a link typed in *Saved copy*, then read the filing's row in the Filings list. The link is there or it is not.
- Row 3: as the office, edit the cover letter and press *Send all N to the leader*. Reopen as a leader and read the letter before approving.
- Rows 8 to 13 only open windows. They are safe on real rows.
