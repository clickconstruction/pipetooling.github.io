---
name: "Safety orange that reads: the Bids tabs, the form hints and the orange buttons"
number: 198
group: ready
status: investigated 2026-10-28 on branch claude/198-199-contrast-investigation · every orange use listed and measured in both themes, the mock-up drawn · three calls wait on the owner · the three calls taken 2026-10-29 on the before-and-after canvas: A, A, A (the fill stays, the words change)
summary: >
  The app's safety orange #FF6600 fails contrast wherever it carries words. The Bids tabs Counts,
  Pricing and Cover Letter read 2.62:1 as orange words on the page and 2.94:1 as white words on the
  orange when open, so What everyone sees flags every Bids tab in light mode, and the open one in dark too.
  Thirteen form hints put
  orange words on white, and seven buttons and one count put white words on the orange. PR #6314 kept
  the clock-in orange and made the words on it near-black. The investigation of 2026-10-28 found 27
  uses in 22 files, measured each in both themes, and recommends Clock In's rule for the rest: keep
  every fill, and give the words the two tokens the app already has.
next: One PR carries the three picks (near-black words on the orange fill for the open tab, the buttons and the pending count; the orange word token for the closed tabs and the 13 hints), with the pin test, a release note and a fragment; then delete this file.
size: S — one function in bidStyles.ts, one shared constant, 13 hint sites and 8 button sites that each swap a literal for a token, two test files; 22 files
blocker: none
opinion: build — A on all three, as recommended
mockup: safety-orange-and-portal-contrast-before-after.html
---

# Safety orange that reads (#198)

## The ask

The owner, 2026-10-27: *"add these two suggested tasks to the punchlist with a note to investigate
before we build"*. This is one of the two. Settings → **What everyone sees** (punch list #194)
found it on 2026-10-27. It was left out of PR #6314, which fixed the four pairs named first: the
Clock In bar, the Bids mode chip, the Calendar's dates and the portal's small print.

## Investigate before we build

The owner asked for a look before any code. The investigation answers four questions. Each is
answered under **Investigated 2026-10-28** below.

1. **Where does the orange carry words?** Start with `git grep -n -i "#ff6600" -- src` and the
   `SAFETY_ORANGE` constant. Sort each use by what it means: a highlighted Bids tab, a warning or
   *Required* hint, a main button, an icon.
2. **How does each one read?** Measure each in light and dark, by number and in the lens
   (Across → Every screen, both themes, each role that sees it).
3. **Which uses are orange on purpose?** The Counts, Pricing and Cover Letter highlight is OSHA
   safety orange by name. A *Required* hint may only have borrowed the colour, and the app's amber
   or red words might suit it better. The clock-in family is already done.
4. **What are the owner's options?** Show each with a before-and-after mock-up on made-up data.

## Investigated 2026-10-28

The mock-up beside this card, `safety-orange-and-portal-contrast-before-after.html`, draws every
spot below as Now beside each option, in light and in dark, and computes every ratio in the page
from the colours drawn with the lens's own formula. The green-edged panel is the recommendation.

### 1. Where the orange carries words

`git grep -n -i "ff6600" -- src` finds 31 lines in 22 files. Sorted by what each means:

- **The highlighted Bids tabs** (1 function, on every Bids tab): `bidsTabStyle` in
  `src/lib/bids/bidStyles.ts`. A closed Counts, Pricing or Cover Letter tab is orange words at
  weight 600 on the page; the open one is white words on the orange fill.
- **White words on the orange** (8 sites, 6 files): the two import buttons *Import from /Tooling*
  and *Paste counts* in `BidsCountsTab.tsx`; *Sent Bid Script* and *Bid Question Script* in
  `BidSubmissionFollowupTab.tsx` (the only two that read `SAFETY_ORANGE` by name); the schedule's
  *Send now* in `ScheduleShareModal.tsx` and the share button in `ScheduleDispatchHubPage.tsx`; the
  send in `ScheduleDayEmailModal.tsx`; and the Bid Board's *Pending* count in `BidsBidBoardTab.tsx`
  when it is above zero.
- **Orange words on a light ground** (13 sites, 11 files), every one a hint under a dimmed button:
  the *Required:* list under Save in `AddInspectionModal`, `NewCustomerForm`, `NewReportModal`,
  `NewProjectForm`, `EditProjectForm`, `JobsSubLaborFormModal` and `JobFormFooter`, under Forward
  twice in `Checklist.tsx`, and in `BidFormModal` (with its autosave warning, the `warn` tone of
  `autosaveLineColor`); *Paste data to import* in `BidsCountsTab`; *Select a template* in
  `WorkflowStagesList`.
- **Graphics, not words** (5 sites, 3 files): the Test report, gavel and fee icons in
  `StagesRowActionButtons.tsx`, the gavel in `StagesToolsMenuGlyph.tsx`, and the Lien desk shortcut
  `.stagesDeskShortcut[data-desk='lien']` in `src/index.css`.
- **Done already** (1 file): `CLOCK_IN_ACCENT_ORANGE` in `src/lib/clock/clockColors.ts`, whose
  words took `CLOCK_IN_ACCENT_TEXT` in v2.5981.

### 2. How each one reads

By number, the lens's formula (`contrastRatio` in `src/lib/lens/lensAudit.ts`), on the grounds the
app draws them on: the page `--bg-page` (`#f0f2f5` light, `#111827` dark) under the tab row, and the
surface `--surface` (`#ffffff` light, `#1f2937` dark) under a modal's hint.

| Where | Light | Dark |
|---|---|---|
| A closed highlighted Bids tab, `#FF6600` words on the page, 15 px semibold | **2.62:1** | 6.04:1 |
| An open highlighted tab, white on `#FF6600` | **2.94:1** | **2.94:1** |
| A form hint, `#FF6600` words on the surface, 12.8 px | **2.94:1** | 5.00:1 |
| A button or the pending count, white on `#FF6600` | **2.94:1** | **2.94:1** |
| An orange icon on the surface (a graphic; the 3:1 rule for graphics, which the lens does not check) | 2.94:1 | 5.00:1 |

In the lens on 2026-10-27 (v2.5981's check, as the estimator at 375 px): every Bids tab in light
shows the three tab flags, and Bid Board read clean in dark. The hints and the buttons show only
when their state is on (a form with a field missing, a bid with pending rows), so the sample data
did not raise them; the numbers above are the same pair the Clock In bar had.

**Confirmed live 2026-10-28** on the dev server, as the estimator, Where → Counts, Across → Widths
and themes. Light at 375, 768 and 1280 each show 3 texts under 3:1: *Counts* white on `#FF6600`
(2.94:1), *Pricing* and *Cover Letter* `#FF6600` on the page (2.62:1). Dark at every width shows 1:
*Counts*, the open tab (2.94:1). The 10-27 check read the tabs clean in dark because it looked at
Bid Board, where no orange tab is open; on Counts, Pricing or Cover Letter the open tab fails in both
themes. A frame can read Clean on its first draw, before the tab row is in; press its Reload and read
it again.

### 3. Which uses are orange on purpose

- **The tabs** are OSHA safety orange by name, chosen. The highlight is the colour, not the words.
- **The buttons** share the clock-in family's meaning, a main press in the orange brand.
- **The hints** borrowed the colour for a warning. None is safety orange by meaning.
- **The icons** are the desk's identity, graphics the lens never flags.

### 4. The options, with numbers

- **A · keep the fill, change the words** (recommended). Words on the orange take
  `CLOCK_IN_ACCENT_TEXT` (`var(--text-on-bright-solid)`, `#111827` in both themes): 6.04:1, Clock
  In's own pair. Words on a light ground take `var(--text-orange-700)`: `#c2410c` in light (4.62:1 on
  the page, 5.18:1 on white) and `#fdba74` in dark (10.5:1 on the page, 8.7:1 on the surface). Both
  tokens exist today; no new value in `src/index.css`. The orange stays `#FF6600` everywhere.
- **B · darken the fill, keep white words.** The lightest same-hue orange that reads with white and
  as words on the light page is `#bb4b00` (5.10:1 with white, 4.55:1 on the page). It is brown, not
  safety orange, the buttons stop matching Clock In, and in dark the closed tab gets worse (4.55:1
  is still fine, but down from 6.04:1).
- **C · the hints take the app's warning amber**, `var(--text-amber-700)` (`#b45309`, 5.02:1 on
  white, 4.48:1 on the grey page; `#fbbf24` in dark, 8.79:1), and the orange keeps to the tabs and
  the buttons, which take A. A meaning rather than a brand; it leaves no orange words on a light
  ground except the closed tab.
- **The icons** stay as they are under every option. If the owner wants one rule for every orange
  on a light ground, the same word token lifts them to 5.18:1 in light and turns them pale in dark.

### The owner's three calls

| Call | Recommended | Also drawn |
|---|---|---|
| 1 · the Bids tabs | A · keep the fill, near-black words open, the orange word token closed | B · darken the fill to `#bb4b00` |
| 2 · the form hints | A · the orange word token | C · the warning amber |
| 3 · the buttons and the pending count | A · near-black words on the fill | B · darken the fill |

## Where it plugs in

- **The tabs:** `src/lib/bids/bidStyles.ts` holds `SAFETY_ORANGE`, `SAFETY_ORANGE_BORDER` and
  `bidsTabStyle`. `src/lib/bids/bidStyles.test.ts` pins `open.color === 'white'` and
  `closed.color === SAFETY_ORANGE`; both lines change with the pick.
- **White words on the orange:** the eight sites under *Investigated*, each taking one shared
  constant for the words (the clock's `CLOCK_IN_ACCENT_TEXT`, or a `SAFETY_ORANGE_TEXT` beside the
  fill in `bidStyles.ts` that reads the same token) so a new orange button cannot drift.
- **Orange words:** the thirteen hint sites, each swapping the literal for the token.
- **Done already:** the clock-in orange, in `src/lib/clock/clockColors.ts`
  (`CLOCK_IN_ACCENT_TEXT`, PR #6314).
- **The pin:** `src/lib/readablePairs.test.ts` (PR #6314) holds each pair at 4.5:1 in both themes.
  Add the closed tab on the page, the open tab's words on the fill, a hint on the surface and a
  button's words on the fill.

## Plan

1. The investigation and the mock-up, then the owner's pick. **Done 2026-10-28; the calls are above.**
2. One PR: the constant, the function, the 21 sites and the pin test, with a release note and a
   `docs/recent-features` fragment. Nothing in `src/index.css` under A; a `data-theme` change under
   B would also run the Lens report workflow.

## How to verify

Sign in with `/dev-login?as=1` and open `/settings?tab=settings-what-everyone-sees`. Pick the
estimator, then Across → Every screen, then press **Check every screen** in light and in dark. No
Bids tab should show text under 3:1. Open a New customer form with nothing filled and the Bid
Board with a pending bid, and read the hint and the count in both themes.

When the browser pane is hidden, CSS transitions freeze, so a button can read its old colour. Draw
one to three frames at a time on the dev server, and read the colours once they settle.
