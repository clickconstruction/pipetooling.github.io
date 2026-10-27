---
name: "A desk is a page with a route: the Legal desk first"
number: 182
group: gated
status: "building · PR 1 v2.5894 (the page behind the redirect, #6240) and PR 2 v2.5936 (every door opens the page, the window leaves the Pipeline) built 2026-10-26 · left: PR 3 (the window frame goes, the phone rail as a list), then the live check against the mock-up"
summary: >
  Four places where a person works for an hour are drawn as windows over a page: the Legal
  desk, the Lien desk, the bank payments window and the job window. Each window must pass four
  CI codemods and the nested-windows check, carry a full-screen button, freeze the page under
  it, and open from a one-shot link the page strips, so a reload forgets it and Back leaves the
  Pipeline. On a phone the Legal desk's rail takes 300 of 351 pixels and the account sits off
  the screen. The rule: a desk is a page with its own address when a person stays in it, it has
  tabs or views of its own, and the page under it goes unread while it is open. A window is
  right when it is one act and the page under it is where you go back to. The Legal desk moves
  first, to /legal-desk, behind redirects from every link in the wild, in three PRs. The Lien
  desk and the bank window follow. The job window stays a window and gains an address.
next: PR 3 on a branch stacked on PR 2, then check the live page against the mock-up once the three have deployed. The owner said yes to the rule on 2026-10-26 and took the plan as written, the phone rail in PR 3.
size: M, as three PRs, M M S
blocker: none. PR #6175 still edits src/App.tsx, one line apart from PR 1’s route.
ver: v2.5894 · 5936
opinion: "build: PR 1 alone proves the rule for a route, a gate and one prop, and PR 3 gives a phone its account back"
mockup: to-dos/desks-as-pages/mockup.html
---

# A desk is a page with a route: the Legal desk first (#182)

## The ask

The owner, 2026-10-26, in a holistic look at how the app feels to use:

> a rule that a desk is a page with a route, and move one (the Legal desk first) to see what it
> saves. Help me come up with a plan and then ask yourself is this the best we can do and then
> show me a mockup and present your plan of what we should do.

The precedent is the Customer Hub. A customer used to be a window over the Customers list. Since
v2.1775 a customer is a page at `/customers/:id` with its tabs in `?tab=`. GC projects live at
`/gc?view=` and the Bridge at `/bridge`. Messages opens a thread as a window over the page and
keeps it in the address as `?thread=`. Those three shapes are the three answers below.

## 1 · The rule

Six questions decide it. Ask them of any surface a person opens over a page.

1. **How long does a person stay?** One act, or minutes at a time.
2. **Does it have tabs or views of its own?** A window with tabs is a page in a frame.
3. **Does it open from more than one place, or from a link?** Every door is a redirect to keep.
4. **Does it need a full-screen button?** The button is the window asking to be a page.
5. **Does the page under it matter while it is open?** Do you read it, or only return to it.
6. **Does a phone already show it full screen?** Then a page costs the phone nothing.

**The rule in one sentence.** A desk is a page with its own address when a person stays in it,
it has tabs or views of its own, and the page under it goes unread while it is open. A window is
right when it is one act and the page under it is where you go back to.

There are three answers, not two:

- **A page.** Its own route, its tabs and views in the address, Back goes where you came from.
- **A window.** One act over the page you are on. Esc or a tap outside returns you to it.
- **A window with an address.** A window that opens from everywhere and is worth a link. The
  address keeps it while it is open, as Messages keeps `?thread=`. A reload reopens it.

### The rule applied

| Surface | Stays | Own tabs or views | Doors and links | Full-screen button | The page under it matters | Phone already full screen | Answer |
|---|---|---|---|---|---|---|---|
| **Legal desk** (`LegalDeskModal.tsx`, 987 lines) | an hour | six tabs, Accounts and Map, two firm windows | four doors on the Pipeline, the Dashboard's Needs you line, `?legal=1`, `?legal=<key>&legalTab=` | yes, v2.5780 | no. The board is dimmed and frozen. The desk reads its rows and nothing else | a sheet, with the account off the screen | **a page** |
| **Lien desk** (`LienDeskModal.tsx` 3,591 + the run 981) | an hour | Do now, Deadlines, All filings, then four kinds, the Calendar, the run window | the gavel, the ☰ menu, the Collections header, three Dashboard cards, the forecast, `?liendesk=1&kind=&liendeskJob=` | yes, v2.4065, and most browsers remember it full | no | a sheet | **a page**, second |
| **Bank payments** (`BankPaymentsModal.tsx`, 3,539) | twenty minutes | the cases, the lenses, the breakdown | three mounts: `/accounts-receivable`, the Billed header's `?openBankPayments=1`, the Dashboard's AR card | yes, v2.4065 | no. The AR page under it is a Back button and a title | a sheet | **already half a page**. Finish it |
| **Job window** (`JobFormModal.tsx`, 3,543) | minutes to an hour | Job, Edit, Bill, Costs | every row, every schedule block, Messages, both desks, `?jobDetail=` | no | yes. You came from a row and go back to the next one | a sheet with its own action bar | **a window with an address** |
| **Tell the customer** sheet | one send | Tell, then the receipt | the job's or the estimate's send | no | yes. The job you are telling them about | a sheet | **a window** |
| **Sort all** desk | five minutes | one card at a time | New's header on Messages | no | yes. New is read again after every press, and the desk closes into the thread | a sheet | **a window** |

The rule cuts both ways. Two of the six stay windows because the page under them is the point.
The job window stays a window because its page is wherever you were. It only gains an address,
which is its own small to-do and not this move.

## 2 · Today, measured

Read on this worktree's dev server as the dev on 2026-10-26, on live rows. No name or amount
from the screen is in this folder. The mock-up's data is made up.

| | Desktop, 1024 × 768 | Phone preset, 375 × 812 |
|---|---|---|
| The desk's frame | a window 1,000 × 706 over the dimmed board | a sheet 351 wide |
| Its header | 119 px: the title row and the control row | 123 px, the subtitle cut |
| The rail | 300 px of the window | **300 px of the 351** |
| The account | the rest, with six tabs and the fix list | **starts at x = 330**. Every tab is off the screen |
| Full-screen button | yes, beside the ✕ | not drawn. A phone is full screen already |
| The address after it opens | `/jobs?tab=stages`. The desk is not in it | the same |
| Reload | the desk is gone | the same |
| Back | leaves the Pipeline | the same |
| Doors from this screen | the scales on the stage bar, the ☰ row, the Collections header's ⚖ Legal | one: the Collections header's ⚖ Legal, after a sideways scroll of the stage strip and a tap on Coll. |

Two things the numbers do not show. The Lien desk opened full screen in the same browser,
because `modal_full_screen_lien-desk` was remembered there, and the Legal desk opened as a window,
because its key was not. One person, two desks, two memories. And the page under the desk is
frozen by the app-wide rule for any window, so while the desk is open the board is a backdrop
and nothing more.

## 3 · The plan for the Legal desk

### What the window takes from the board, and what it reads itself

[`docs/JOBS_STAGES_TAB_ARCHITECTURE.md`](../../docs/JOBS_STAGES_TAB_ARCHITECTURE.md)'s row for
the desk: always mounted at the tab's foot, fed the board's **filtered** `collectionsJobs`, the
contract coverage and `legalMatters`, with many doors back into the board. The props of
[`LegalDeskModal.tsx`](../../src/components/jobs/legal/LegalDeskModal.tsx), and where the page
gets each one:

| Prop | Today, from the tab | On the page |
|---|---|---|
| `collectionsJobs`, `uncollectibleJobs` | `stagesBoardLists` over the jobs cache, narrowed by the board's search and customer filter. The desk is one of four money surfaces that read filtered rows, quirk 4 | `useJobsListCache()` as `/accounts-receivable` reads it, then `buildJobsStagesBoardLists(jobs, '')`. Unfiltered, as a money surface should be. `?account=` is the narrowing |
| `jobsLoading` | the non-paid scopes not merged yet | the same cache's scope state. The page asks the cache for the non-paid scopes itself, the way the tab's effect at line 800 does today |
| `contractCoverage` | `useJobContractCoverage(jobs, canSeeJobContracts)` in the tab | the same hook, called by the page |
| `users` | the page's `users` prop | the users read the Jobs page already does |
| `companyName` | `PORTAL_COMPANY.name` | the same constant |
| `legal` | `useLegalMatters(isStagesOfficeRole)` in the tab, line 790 | `useLegalMatters(true)` on the page. The tab keeps its own call for the rows' ⚖ chips, the scales' count and the Lien desk's sign-off. The two are never mounted at once |
| `canMarkReady`, `canEditReview`, `canEditFirm` | `authRole` | `useAuth().role`, the same three tests |
| `initialPayerKey`, `initialTab` | the tab's `legalDesk` state, set by the handle | `?account=` and `?tab=` |
| `open`, `onClose`, `overlayZIndex` | the window's frame | gone |

What the desk reads for itself stays with it. `useLegalMapCases` places every case on the county
map. `useLegalPacketData` builds one account's packet. The firm windows read the firm. None of it
touches the board.

### The page

- **Route.** `/legal-desk`. Not `/legal`, which is the firm's own portal, with `/legal/confirm`
  beside it. A lazy page in `App.tsx` beside `accounts-receivable`.
- **Address.** `/legal-desk` opens the rail, largest net first, the first account open on a
  desktop. `?account=<payer key>` opens one account. `&tab=` takes `narrative`, `account`,
  `paper`, `evidence`, `firm` or `timeline`, and `fees` as the old name of `firm`. `&view=map`
  opens the Map. The default view is never written. One kernel owns it,
  `src/lib/legal/legalDeskRoute.ts`: parse the address, build an href, map the old params.
- **Gate.** The collections roles, as today: `canManageCollections`, which is dev, master,
  assistant and controller. The page waits for the role and sends anyone else to the Dashboard,
  as `/accounts-receivable` does. `isPathAllowedForRole` already keeps estimators, primaries,
  superintendents and subs off any path not on their lists, so the kernel needs no new entry.
- **The header.** A **← Pipeline** door at the left, the scales and the title, the subtitle. At
  the right the Accounts and Map group, the firm group and Firms… as they are. No ⤢. No ✕.
- **Back.** The browser's Back, and the ← door, which goes to the page behind when there is one
  and to `/jobs?tab=stages` on a cold open, with `hasInAppHistory` as the AR page uses it.
- **Nav.** No link in the top nav. The Pipeline's three doors, the Dashboard's line and the
  address are the doors. A row in the ⚙ menu's secondary pages can come later if asked.

### Every old link redirects

No link in the wild breaks. The `?legal=` effect in `Jobs.tsx`, 32 lines today, becomes a
`Navigate replace` to what the kernel returns, and it stays for good.

| Link today | Where it goes |
|---|---|
| `/jobs?tab=stages&legal=1` | `/legal-desk` |
| `/jobs?tab=stages&legal=<key>` | `/legal-desk?account=<key>` |
| `…&legalTab=fees` | `…&tab=firm` |
| `…&legalTab=timeline` | `…&tab=timeline` |
| the Dashboard's Needs you line, `needsYouDoors.ts` line 153 | writes the new href, and the old one redirects anyway |
| the scales, the ☰ row, the Collections header's ⚖ Legal | links to `/legal-desk`, the count still on them |
| the Lien desk's `onOpenLegalDesk`, Put a GC on notice's Legal desk matter | `navigate('/legal-desk')` |
| the guide, the supply houses guide, `APP_DIRECTORY.md` | rewritten to the new address |
| the four fragments that name the old link | frozen. History stays as it was |

### The doors back

Eleven doors leave the desk today, each a callback into the tab. On the page each has a home:

| Door | Today | On the page |
|---|---|---|
| Edit job, Set the GC | `tryOpenEditJob`, the app-wide Job form | the same context, `useJobFormModal().openEditJob` |
| Open the job's row on the board | `onFocusJob` closes the desk and scrolls the row | `/jobs?tab=stages&stagesJob=<id>`, which the Pipeline already answers |
| Accounts Receivable | the tab's bank window | `/accounts-receivable`, a page already |
| Call mode | the tab's chase window | `/jobs?tab=stages&stagesMoney=chase`, which the Pipeline already answers |
| Contract desk, the job's Lien window, Session notes, Reports, Promised pay date | windows the tab owns | the page mounts the same five, as `/accounts-receivable` mounts its window. Each is one act over the desk, so each is a window by the rule |
| The job's thread | `openJobThreadFullscreen` from the page's `useJobThreadNotes` | the job window's Job tab, which holds the thread. One door fewer |
| After a write-down | `loadJobs()` | the cache's `runFetchJobs` |

A job opens as a window over the page, as the mock-up's third frame shows. That is the rule
cutting the other way on the same screen.

### What stops applying

- **The full-screen toggle.** `useModalFullScreen('legal-desk')`, `ModalFullScreenButton`,
  `FULL_SCREEN_BTN`, the padding that switches on `fullScreen` and `data-legal-desk-panel`. The
  page is always the whole screen between the app's chrome. The remembered key is never read
  again.
- **Five checks.** The desk's overlay is one site for `check:status-bar`, `check:window-z`,
  `check:backdrop-click` and `check:dialog-role`, and `check:nested-windows` walks its eight
  sheets, two firm windows and the firm preview inside a backdrop that closes on a click. On a
  page there is no outer backdrop. The eleven inner windows keep their own dialog roles and lose
  their fifteen `e.stopPropagation()` calls.
- **The frozen page.** The app-wide scroll lock holds the board still under the desk. A page
  scrolls.

### Tests

- `LegalDeskModal.render.test.tsx`, 17 cases. Two go: *a click outside Ask a dev to review
  closes the sheet only* and its sibling, since there is no outer window to protect. The
  full-screen case goes with the button. The other fourteen hold.
- New: `legalDeskRoute.test.ts` for the kernel, and `LegalDeskPage.render.test.tsx` for the
  gate, the ← door, and the address following a tab, a view and an account.
- Changed: `JobsStagesJumpStrip.render.test.tsx` and `stagesSectionToolsMenu.test.ts` see a link
  where a press was. `needsYouDoors` tests see the new href. `appDirectoryCheck.test.ts` sees the
  route it names.

### Docs

`docs/twins/APP_DIRECTORY.md` gains `### /legal-desk — Legal desk` and its five lines move under
it. `PROJECT_DOCUMENTATION.md` gains the page and loses the window from the Jobs line.
`GLOSSARY.md` → Legal desk. `ACCESS_CONTROL.md` gains the page's matrix row and amends the Legal
desk section. `JOBS_STAGES_TAB_ARCHITECTURE.md` loses row 4406, the `openLegalDesk` method and
quirk 4's exception. `JOBS_TABS_ARCHITECTURE.md` reads a redirect where the effect was.
`APP_SHELL_ARCHITECTURE.md` counts one more route. `LIEN_DESK_ARCHITECTURE.md` renames the
gavel's neighbour. The rule itself gets one line under CLAUDE.md's working conventions, with its
reason, and its table lives in `APP_SHELL_ARCHITECTURE.md`, since that is where routes live.

### The guide

*review a collections account before it goes to your attorney*. **Open the desk** says the
three doors on the Pipeline, the Dashboard's line and the address. The full screen paragraph
goes. A new sentence says Back returns you to the Pipeline, and that the address bar is the link
to share. **See every case on the map** says the Map keeps `?view=map`. On a phone, the rail is
the list and an account opens from it. *see which supply houses are owed on a lien job* changes
its one link.

### The PRs, in order

| PR | What ships | Files | A rebase meets |
|---|---|---|---|
| **1 · The route, behind a redirect** (M) | `src/pages/LegalDeskPage.tsx`, lazy in `App.tsx`, gated as above. It reads the cache, the coverage, the users and the matters for itself and renders today's `LegalDeskModal` with one new prop, `frame: 'page'`, which drops the overlay, the ✕, the toggle and `overlayZIndex`. `legalDeskRoute.ts` and its tests. `Jobs.tsx`'s effect becomes the redirect. The directory heading. One sentence in the guide. The three Pipeline doors still open the window, so nothing else moves | `App.tsx`, `Jobs.tsx`, the new page, `LegalDeskModal.tsx`, the kernel, `APP_DIRECTORY.md`, the guide | **#6180** (a dev lands on the Bridge, `App.tsx` and the directory) and **#6175** (the rating ask, the same two). One line each. Land them first |
| **2 · The doors go to the page** (M) | The scales, the ☰ row and the header's ⚖ Legal become links. The Needs you line writes the new href. The Lien desk and Put a GC on notice navigate. The window's mount leaves `JobsStagesTab`: the `legalDesk` state, the scope kick, the handle's method, the mount and its sixteen callbacks. The five windows the desk needs mount on the page. The docs above | `JobsStagesTab.tsx`, `JobsStagesJumpStrip.tsx`, `stagesSectionToolsMenu.ts`, `needsYouDoors.ts`, `LienDeskModal.tsx`, `GcOnNoticeModal.tsx`, the page, eight docs | the dev-gates audit if it touches `needsYouDoors.ts`. Any Pipeline PR that edits the tab's tail |
| **3 · The window frame goes** (S) | `frame` is no longer a prop. The overlay, the two test cases, the fifteen `stopPropagation` calls and the toggle go. `LegalDeskModal.tsx` becomes `LegalDesk.tsx` with its test. On a phone the rail is its own view: `/legal-desk` lists the accounts, `?account=` opens one with **← Accounts** on top | `LegalDesk.tsx`, its test, `legalDeskShared.tsx`, the page, the guide | nothing outside the desk's folder |

Each PR ships a release note and a fragment. PR 1 is the proof: a desk becomes a page for a
route, a gate and one prop, and a rollback is deleting the route.

### What the move saves

**Lines.** About 120 leave the two God files and the desk. `Jobs.tsx` loses 26 of the effect's
32. `JobsStagesTab.tsx`, 4,845 lines and 112 `useState`, loses one state, one effect, one handle
method and a 35-line mount, and gains three links. The desk loses the overlay, the toggle, the
padding switch and the fifteen stops. The page is about 90 new lines and the kernel 40.

**Checks.** The desk leaves four codemods' site lists and the nested-windows walk. Every future
change to its header, its sheets or its height is free of the `--app-top-chrome` padding rule,
the z-index ladder and the backdrop rules. The eleven inner windows keep theirs.

**Taps and loads.** From the Dashboard's line, one tap either way, but today that tap loads the
whole Pipeline before the desk opens, since the effect waits on `jobsListLoading`. The page loads
the non-paid scopes and the legal tables, nothing more. From a phone, three taps and a sideways
scroll become one tap, and the account is on the screen. A reload keeps the account, the tab and
the view. The address bar is the link to paste, where today the link is a one-shot param the page
strips on arrival.

**On the next three desks.** The kernel becomes `deskRoute.ts` with one map per desk, so each
move is a route, a gate and a redirect map. The Lien desk already reads for itself through
`useLienDeskData`, so its page is the frame and the redirect table, with the run window staying a
window over it: about S. The bank window is a page already at `/accounts-receivable`; the two
other mounts become links to `/accounts-receivable?check=`, and three mounts become one: S. The
job window is not a page by the rule, and gains `?job=` instead: its own small to-do. Each desk
that moves drops one site from each of the five checks and one full-screen memory from every
browser.

## 4 · Is this the best we can do?

**What a window gives that a page loses.** The board's context under it, and one click back.
Honestly: the board under the desk is dimmed and frozen, and the desk reads nothing from it while
it is open. The one click back is the ✕, and it returns you to the board at its top, not at the
row. The page's ← and Back return you to the Pipeline as you left it, from the app-wide jobs
cache, which the hop does not empty. The row door becomes `?stagesJob=`, which scrolls to the
row and lights it. The window loses that argument.

**Does the full-screen button already give most of the win for less?** It gives the room, and
the owner asked for it on 2026-10-23 for exactly that. It does not give the address, Back, a
phone that works, the lighter load, or freedom from the five checks. And its memory is per
browser and per desk, which is why the two desks opened differently in the same browser on the
same morning. If the owner wants only the room, the button is done and this move is for the four
other things. The plan says so under Decisions.

**Is the Lien desk or the job window the better first case?** The Lien desk would prove more
and cost three times as much: 4,572 lines across two files, 34 render cases, a run window, a
Calendar, Share, the ☎ door and links that carry a job, a kind and a pile. PR #6158 is open on
its Release window today. The job window is not a page by the rule. The Legal desk is 987 lines,
17 cases, four doors, two links, two views, and a phone that does not work. It is the smallest
desk with every property the rule names. First case stands.

**What breaks for a phone.** Nothing new breaks, and nothing is fixed until PR 3. The page at
phone width in PR 1 is the same two columns the window draws, so a phone is no worse off. The
phone board's open stage is kept per device, so Back from the page lands on the stage you left.
The real phone win is the rail as a list, which the window could never do, and it sits in PR 3.
If the office reads the desk on phones, it should come sooner. The plan asks.

**What is the smallest move that still proves the rule?** PR 1 alone: a route that renders the
same component full page, behind a redirect, with every door still opening the window. It
proves that a page costs a route, a gate and one prop, and it can be reverted by deleting the
route. Nothing in the Pipeline changes until PR 2.

**Where the argument won, the plan changed.** PR 1 moves no door, so the risk is one file and
one route. The job window left the next-three list and became a window with an address, its own
to-do. The phone rail is offered to move from PR 3 to PR 2 as a decision. The Lien desk waits
until the Legal desk has been a page for a week and the owner has looked.

## Decisions for the owner

1. **The rule, yes or no.** The one sentence under part 1, as a line in CLAUDE.md's working
   conventions, with its table in `APP_SHELL_ARCHITECTURE.md`.
2. **Where the phone rail goes.** PR 3 as planned, or PR 2 if the office reads the desk on
   phones today.
3. **Or stop at the button.** If the room was the whole ask, the full-screen button of v2.5780
   is done and this folder closes with the rule written down and no move.

## Where it plugs in

- **The page.** `src/pages/LegalDeskPage.tsx`, new, shaped like
  [`JobsAccountsReceivable.tsx`](../../src/pages/JobsAccountsReceivable.tsx): the auth wait,
  the role gate, the ← door with `hasInAppHistory`, the cache read, the component.
- **The kernel.** `src/lib/legal/legalDeskRoute.ts`, new: `legalDeskHref({ account, tab,
  view })`, `legalDeskFromSearch(search)`, `legalDeskRedirect(oldSearch)`. Tested.
- **The desk.** [`LegalDeskModal.tsx`](../../src/components/jobs/legal/LegalDeskModal.tsx): the
  `frame` prop in PR 1, the frame gone in PR 3, the tab and view state written to the address
  through `useSearchParams`.
- **The doors.** `StagesLegalDeskShortcut` in
  [`JobsStagesJumpStrip.tsx`](../../src/components/jobs/JobsStagesJumpStrip.tsx), the
  `legal-desk` row in [`stagesSectionToolsMenu.ts`](../../src/lib/jobs/stagesSectionToolsMenu.ts),
  the Collections header's button in `JobsStagesTab.tsx` at its line 3981, and
  [`needsYouDoors.ts`](../../src/lib/needsYouDoors.ts) line 153.
- **The redirect.** `Jobs.tsx` lines 1153 to 1184.
- **The shell.** `App.tsx`'s route list and `docs/twins/APP_DIRECTORY.md`, both under edit by
  #6180 and #6175 today.

## How to verify

PR 1 on the dev server as the dev. Open `/legal-desk` and read the same rail and account the
window shows, with no dim, no ✕ and no ⤢. Open `/jobs?tab=stages&legal=1` and watch the address
become `/legal-desk`. Open `/jobs?tab=stages&legal=<key>&legalTab=timeline` and land on that
account's Timeline with the address saying so. Reload and stay there. Press ← and land on the
Pipeline. Open the page as an estimator through a pasted link and land on the Dashboard. On the
phone preset the page draws what the window drew. Press nothing that writes: no Mark attorney
ready, no plan step, no note.

PR 2: the scales, the ☰ row, the header button and the Dashboard's line each open the page with
the count still on them. A job's row door lands on the Pipeline at the row. Edit job opens over
the page. Nothing in `JobsStagesTab.tsx` names `legalDesk`.

PR 3: at the phone preset `/legal-desk` is a list of accounts, a tap opens one with ← Accounts
on top, and Back returns to the list. `check:nested-windows` and the four codemods pass with the
desk's sites gone.

## Where it stands

The owner, 2026-10-26, on the proposal: "I like your suggestion, please build it testing along the
way." The rule is taken, and the plan as written.

| PR | What | Version | State |
|---|---|---|---|
| 1 · the route, behind a redirect | `/legal-desk`, `legalDeskRoute.ts`, the `frame` prop, the `?legal=` redirect, the directory and the guide | v2.5894 | built 2026-10-26 on `claude/legal-desk-page-pr1` |
| 2 · the doors go to the page | the scales a link, the ☰ row, the header’s ⚖ Legal, the Lien desk’s door and the Dashboard’s two lines go to the page; the mount leaves `JobsStagesTab`; the docs | v2.5936 | built 2026-10-26, stacked on PR 1 |
| 3 · the window frame goes | the overlay, the toggle and the stops go; `LegalDesk.tsx`; the phone’s rail as a list | | next |
