---
name: "Lien desk: open on Next up, and name the next step on the job"
number: 82
group: ready
status: building 2026-10-05 · branch feat/lien-next-up-kernel · PR 1 (the kernel) is up; no screen has changed yet
summary: >
  The lien work is sound but it is organised by kind of paper: five windows, five tabs on the
  desk, three places that send the same § 53.056 notice. A person has to know lien law to know
  which window to open. The proposal organises it by one question, "what do I do next?". The
  Lien desk opens on **Next up**, one list in deadline order where each row carries one button
  that names the next move and opens the screen that exists today. The job's Lien window gains
  a card that names its next step. A GC's run becomes a row in the list. Every action that
  exists today keeps its place: the five inventory files beside this card list all of them
  (about 775) and say where each lives afterwards.
next: PR 2, the Next up view as the desk's first tab and its opening view, over `lienNextUp.ts`.
size: L (five PRs, the first two are S and M)
blocker: None for PRs 1 to 4. PR 5 (tabs into views) waits on a week of use and the owner's yes.
opinion: build — PRs 1 and 2 lose nothing by construction, because Next up only links into screens that exist. Do not merge the desk's Notices pane with the job's Lien window.
---

# Lien desk: open on Next up, and name the next step on the job

## The ask

The owner, 2026-10-05: *"Looking at the lien desk and flow I think what started off as a really good intent has now become quite cluttered and confusing as there are so many ways to address liens. Would you mind taking a look at the app holistically and helping me come up with potentially better ways we can present it all to the user? this could come down to things taking less clicks."*

Shown the proposal and a before / after prototype, he asked: *"are you sure it's right? We don't want to loose any functionality."* That led to the inventory in this folder. Shown the inventory and the corrected proposal: *"What you've proposed and the defects are probably better, please save it all to the punch list so someone else can come by and fix the defects and build all of it."*

The defects are their own card: [`../lien-defects.md`](../lien-defects.md) (#83).

## What is confusing today

| Today | Count |
|---|---|
| Separate lien windows | 5: Lien desk, Lien instruments, Put a GC on notice, Release of Lien, Legal desk |
| Tabs on the Lien desk | 5: Calendar, Notices, Affidavits, Retainage, Timeline |
| Places that send the same § 53.056 notice | 3: the desk, the job's Lien window (by hand), the GC run |
| Lien controls on one Pipeline row | 2: the orange gavel and the blue release |
| Screens that draw a job's lien timeline | 6 |

The clearest sign is that the app needs a guide called *understand how liens work and which lien tool to use*.

## The mock-up

[`mockup.html`](mockup.html) draws three tasks, today on the left and the proposal on the right. The first two are clickable and count clicks. The canvas it came from: *Lien flow: before and after* — https://claude.ai/artifact/3uX5XzH3siMxcg5hjD8iCC

| Task | Today | Proposed |
|---|---|---|
| Draft one job's notice | 3 clicks: gavel, Notices tab, the job | 2 clicks: gavel, the row's **Draft notice** |
| Put a GC on notice | 3 clicks: ⋯ menu, pick the GC in the filter, the row that appears | 2 clicks: gavel, the row's **Send the run** |
| One job's lien paper | The window opens on a tab row; you work out the step yourself | The window opens on a card naming the next step |

The mock-up is a simplified drawing. It shows about 15 of the 775 actions. Read the inventory before building.

## The decision

**Picked: reorganise around "what do I do next?", and link the screens instead of merging them.**

1. **The desk opens on Next up.** One list in deadline order. Each row has a tag for its kind (Notice, Affidavit, Retainage) and one main button. The button is the main action of the state the paper is in: Find the owner, Draft notice, Send the run, Add tracking, Send letter two, File the affidavit. It opens the pane that exists today, on that job.
2. **A GC's run is a row.** A GC with notices ready shows as one row with **Send the run**. It opens the run window or Put a GC on notice, as the header button does today. The header button stays.
3. **The job's Lien window names its next step.** A card above the tab row reads *Your next step*, with the days left and one main button. When the step needs approval, the button opens the Lien desk's Notices pane on that job. The window is renamed *Liens on job N*, so the name "Lien instruments" goes away.
4. **One name per level.** *Lien desk* for everything, *Liens on job N* for one job. A gavel in the bar or a menu opens the desk. The gavel on a row opens that job.
5. **Later, with the owner's yes: the five tabs become three views.** Next up, Calendar, All paper. All paper filters by kind.

**Rejected:**

- **One big window for everything.** That is how the desk got five tabs.
- **A step by step wizard only.** It hides the overview you need when deciding what to chase.
- **Merging the desk's Notices pane and the job's Lien window.** The inventory showed they are different workspaces. Approving a notice lives only on the desk's pane (83 actions). Sending by hand, the demand letter, the affidavit and the release of record live only in the job's window (148). One screen would have to carry about 230 actions. Link them.
- **Release of Lien as the last step on the lien path.** A waiver goes out with each bill, long before any lien step. It stays its own window with its own doors. The job's Lien window gains a row that opens it.
- **Touching the Legal desk.** Handing an account to the attorney is a different job.

## Nothing may be lost: the inventory

Read from the code on 2026-10-05, main at v2.4545. Each file is one table, one row per action, with the control's label, who can use it, whether it writes, and `file:line`. Each ends with an *Easy to miss* list.

| File | Surface | Rows |
|---|---|---|
| [`inventory-1-lien-desk.md`](inventory-1-lien-desk.md) | Lien desk: five tabs, the run, Share, the call sheet | 201 |
| [`inventory-2-lien-window.md`](inventory-2-lien-window.md) | The job's Lien window and its three outside surfaces | 163 |
| [`inventory-3-releases-and-waivers.md`](inventory-3-releases-and-waivers.md) | Release of Lien, waivers, the signing seats, the sub waiver | 145 |
| [`inventory-4-gc-notice-and-legal-desk.md`](inventory-4-gc-notice-and-legal-desk.md) | Put a GC on notice (98) and the Legal desk (79) | 177 |
| [`inventory-5-doors-and-signals.md`](inventory-5-doors-and-signals.md) | Every door into the above, the link parameters, the guides | 89 + 11 |

Line numbers drift. Search for the label when a line no longer matches.

### Where each part lives afterwards

"Unchanged" means the screen and its controls stay, and only how you reach them changes.

**Lien desk (201)**

| Area | Rows | Afterwards | Status |
|---|---|---|---|
| Title bar: close, full screen, § Rules, Share, the five tabs with counts | 6 | Same bar, with Next up as the first tab | Unchanged until PR 5 |
| Pile filters on Notices (8), Affidavits and Retainage | 4 | The same filters. Next up groups by the same states. | Unchanged |
| GC picker to Put a GC on notice, run button, "sent on the leader's word" marker | 4 | Stay on the bar. A GC's run is also a row in Next up. | Unchanged, plus a door |
| Notices list, pane, the four gates, months grid, claim box, the paper and its wording, preview, standing rule | 59 | The same pane. A Next up row opens it on its job. | Unchanged |
| Notices footers by state: draft, by hand, awaiting, ready, held, sent, missed | 32 | The same footers. A row's button is that state's main action. | Unchanged |
| Affidavits list, pane and footers | 18 | The same tab. Rows in Next up. | Unchanged |
| Retainage list, pane and footers | 10 | The same tab. Rows in Next up. | Unchanged. The drawing left it out. |
| Timeline tab: GC filter, due or whole book, print counsel's grid | 6 | The same tab | Unchanged until PR 5 |
| Calendar: buckets, search, houses lens, Set kinds, promised pay dates, key | 17 | The same tab, one click from the landing | Unchanged |
| Someone's calling, the call sheet, practice call | 19 | Same bar | Unchanged |
| Share panel and the team email | 15 | Same bar | Unchanged |
| The run window, with undo | 12 | Same window | Unchanged |

**The job's Lien window (163).** Everything stays. The header is renamed and the next step card is added above the tab row. The supply houses card, the demand letter (47 rows), the filings list, the notice, the affidavit and the release of record are untouched.

**Release of Lien and waivers (145).** Untouched. One new door: a *Waivers on the bills* row in the job's Lien window.

**Put a GC on notice (98) and the Legal desk (79).** Untouched. Put a GC on notice gains one door: a row in Next up.

**Doors (89, plus 11 link parameters).** All kept. One behaviour changes: the desk's on-screen buttons land on Next up where they land on Calendar today. A link that names a job, a pile or a kind keeps landing where it does now.

## What Next up must carry

The drawing shows four rows. The real list needs a row for every state that asks for an act:

| State (source) | Row's main button | Opens |
|---|---|---|
| Notice, `needs_owner` | Find the owner | Notices pane, owner card |
| Notice, `to_draft` | Draft notice | Notices pane |
| Notice, `awaiting` | Approve, for a leader. *Waiting on the leader*, with no button, for the office. | Notices pane |
| Notice, `ready`, one GC with several | Send the run | The run window |
| Notice, `ready`, a single job | Send | Notices pane |
| Notice, `printed` | Add tracking | Notices pane, tracking editor |
| Notice, `held` | Review the hold | Notices pane |
| Notice, `sent`, at day 10 or later | Send letter two | Notices pane, letter two menu |
| Notice, `missed` | Note it | Notices pane, missed footer |
| Affidavit, ready to file | File the affidavit | Affidavits pane |
| Affidavit, filed and not served | Record service | Job's Lien window, Mechanic's lien tab |
| Retainage, ready | Send | Retainage pane |

Order: overdue first, then by the last day. Group as *Needs you now* and *Coming up*. The office and the leader see different buttons on the same row, as the footers do today (`isLienOffice`, `isLienLeader`). A read-only role sees the list and no buttons.

## Where it plugs in

- **Piles and items exist.** `src/lib/jobs/lienDesk.ts` (`LienDeskPile`: `needs_owner`, `to_draft`, `awaiting`, `ready`, `printed`, `held`, `sent`, `missed`), `lienDeskAffidavits.ts`, `lienDeskRetainage.ts`, `lienLetterTwo.ts`, `lienDeskRun.ts`, `lienDeskGcPicker.ts`. Next up is a new kernel over these, with no new read.
- **The desk shell.** `src/components/jobs/LienDeskModal.tsx` holds the tab state, the selected job per list and the pile. The tab resets on every open: Calendar by default, Notices when a door names a job. PR 2 changes that default.
- **The job's window.** `LienInstrumentsModal.tsx` and `LienFilingTabs.tsx`. The next step comes from `src/lib/jobs/lienTimeline.ts`, which already words *Next on the path* and whose move it is.
- **Deep links.** `src/lib/jobs/stagesDeepLinks.ts` and `src/hooks/useStagesDeepLinkParams.ts`. A URL door lands on Notices today and the buttons land on Calendar. Keep every existing parameter working.
- **The host.** `src/components/jobs/JobsStagesTab.tsx` mounts all five windows and wires `onRecorded`.
- **Guides.** `send-lien-notices-from-the-lien-desk`, `see-what-is-due-on-the-lien-calendar`, `file-a-lien-and-never-miss-its-deadlines`, `understand-how-liens-work-and-which-lien-tool-to-use`. Some sit on `LEGACY_PLAIN_WORDS_GUIDES`: a touched one must be rewritten in full.
- **Docs.** `GLOSSARY.md` and `PROJECT_DOCUMENTATION.md` name *Lien instruments* and the desk's tabs.

## The plan

1. **PR 1, the kernel (S) — built 2026-10-05.** `src/lib/jobs/lienNextUp.ts` (`buildLienNextUp`, `groupLienNextUp`; 10 tests). As built it also rows the affidavit and retainage states the table above leaves out (the property record, a draft, an approval, a hold), and a row's `target` names the pane, pile and job to open. The plan read: takes the desk's notice entries, affidavit entries, retainage entries, the GC run groups and the viewer's role, and returns ordered rows `{ key, kind, jobId or gcId, title, sub, dueOn, severity, action, target }`. Unit tests for every state in the table above, both roles, and the order. No screen change.
2. **PR 2, the view (M).** A `LienDeskNextUp.tsx` list as the desk's first tab and its default on a plain open. Each button sets the existing tab, pile and selected job, or opens the run window or the job's Lien window. A phone gets the same list as cards. Render smoke. Update the desk guide.
3. **PR 3, the job's next step (M).** The card above the tab row in the job's Lien window, from `lienTimeline.ts`. The *Waivers on the bills* row that opens Release of Lien. Rename the window to *Liens on job N* everywhere it is named: tooltips, the Documents rows, the forecast button, guides, `GLOSSARY.md`.
4. **PR 4, doors (S).** A GC's run as a Next up row. The Dashboard lien cards land on the row they describe. Do this after the door defects in #83, or fold them in.
5. **PR 5, three views (M, the owner's yes first).** Next up, Calendar, All paper. Safe only if Retainage, the Timeline's whole book and *Print counsel's grid* each keep a named place, and `kind=affidavit` and `kind=timeline` keep landing on their lists. Tick the inventory rows off one by one in the PR description.

Each PR ships its release note, its `docs/recent-features/` fragment and its guide edit.

## How to verify

- Dev login on localhost: `/dev-login?as=1&to=/jobs?tab=stages&liendesk=1`. **This is a prod account on prod data.** Open and close windows only. Do not approve, send, record or schedule on a real job.
- Write paths: use a job on *ZZ TEST GC On Notice* (J1050, J1051, J1052 were made for this on 2026-09-27).
- For PR 2, check each state in the Next up table against the pile it came from: the count of rows per state equals the pile's count on the Notices tab.
- For PR 5, walk `inventory-1-lien-desk.md` top to bottom on the built desk.
- The browser pane reports `document.hidden`, so anything driven by animation frames reads stale until a screenshot is taken.

## Where it stands

Nothing is built. The proposal, the corrected mock-up and the inventory are in this folder. Fix the paper defects in #83 first if only one can be done: three of them affect paper going out today.
