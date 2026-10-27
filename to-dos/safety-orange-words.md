---
name: "Safety orange that reads: the Bids tabs, the form hints and the orange buttons"
number: 198
group: gated
status: proposed 2026-10-27 from the What everyone sees sweep (#194) · investigate before we build, the owner's note
summary: >
  The app's safety orange #FF6600 fails contrast wherever it carries words. The Bids tabs Counts,
  Pricing and Cover Letter read 2.62:1 as orange words on the page and 2.94:1 as white words on the
  orange when open, so What everyone sees flags every Bids tab in light mode. About 15 form hints put
  orange words on white, and a few buttons put white words on the orange. PR #6314 kept the clock-in
  orange and made the words on it near-black. This would carry a rule like that to the rest, after a
  look at every place the orange appears and what each one means.
next: Investigate first, the owner's note of 2026-10-27. List and measure every orange use, then bring the owner a before-and-after with options. Build only after the pick.
size: S, to be confirmed by the investigation (one constant, perhaps a token pair, about 20 files)
blocker: The investigation, then the owner's pick.
opinion: your call — the orange is a chosen safety colour; keep the fill and change the words on it, as Clock In did
---

# Safety orange that reads (#198)

## The ask

The owner, 2026-10-27: *"add these two suggested tasks to the punchlist with a note to investigate
before we build"*. This is one of the two. Settings → **What everyone sees** (punch list #194)
found it on 2026-10-27. It was left out of PR #6314, which fixed the four pairs named first: the
Clock In bar, the Bids mode chip, the Calendar's dates and the portal's small print.

## Investigate before we build

The owner asked for a look before any code. The investigation answers four questions.

1. **Where does the orange carry words?** Start with `git grep -n -i "#ff6600" -- src` and the
   `SAFETY_ORANGE` constant. Sort each use by what it means: a highlighted Bids tab, a warning or
   *Required* hint, a main button, an icon.
2. **How does each one read?** Measure each in light and dark, by number and in the lens
   (Across → Every screen, both themes, each role that sees it).
3. **Which uses are orange on purpose?** The Counts, Pricing and Cover Letter highlight is OSHA
   safety orange by name. A *Required* hint may only have borrowed the colour, and the app's amber
   or red words might suit it better. The clock-in family is already done.
4. **What are the owner's options?** Show each with a before-and-after mock-up on made-up data:
   - **A** · Keep the fill and put dark words on it, Clock In's rule (`CLOCK_IN_ACCENT_TEXT`,
     6.04:1). Words on a light ground take a darker orange, such as `#c2410c` (5.18:1 on white,
     4.62:1 on the page), with a light orange in dark.
   - **B** · Darken the fill and keep white words. The lightest orange that reaches 4.5:1 with white
     is about `#c44e00`, which reads brown.
   - **C** · Move the hints to the app's amber or red word tokens, and keep the orange for the
     highlights and buttons.

## Measured

On 2026-10-27, in What everyone sees as the estimator at 375 px:

| Where | Pair | Ratio |
|---|---|---|
| A closed highlighted Bids tab, light | `#FF6600` on the page `#f0f2f5`, 15 px semibold | 2.62:1 |
| An open highlighted Bids tab | white on `#FF6600` | 2.94:1 |
| A form hint, light | `#FF6600` on white, 12.8 px | 2.94:1 |
| A closed highlighted tab, dark | `#FF6600` on `#111827` | 6.04:1, fine |

The flag shows on every Bids tab in light mode, because the tab row is on every Bids tab.

## Where it plugs in

- **The tabs:** `src/lib/bids/bidStyles.ts` holds `SAFETY_ORANGE`, `SAFETY_ORANGE_BORDER` and
  `bidsTabStyle`. An open tab is white on orange, and a closed one is orange words at weight 600.
  `src/lib/bids/bidStyles.test.ts` pins `open.color === 'white'` and
  `closed.color === SAFETY_ORANGE`.
- **White words on the orange:** the two import buttons in `src/components/bids/BidsCountsTab.tsx`,
  `src/components/schedule/ScheduleShareModal.tsx`,
  `src/components/schedule/ScheduleDispatchHubPage.tsx`, `src/components/ScheduleDayEmailModal.tsx`,
  and the pending count in `src/components/bids/BidsBidBoardTab.tsx`.
- **Orange words:** the form hints in `AddInspectionModal`, `NewCustomerForm`, `NewReportModal`,
  `BidFormModal` (the *Required* line and the autosave warning), `BidsCountsTab`, `JobFormFooter`,
  `JobsSubLaborFormModal`, `EditProjectForm` and `NewProjectForm`. The icons in
  `StagesRowActionButtons` and `StagesToolsMenuGlyph`. The Lien desk shortcut,
  `.stagesDeskShortcut[data-desk='lien']` in `src/index.css`.
- **Done already:** the clock-in orange, in `src/lib/clock/clockColors.ts`
  (`CLOCK_IN_ACCENT_TEXT`, PR #6314).
- **The pin:** `src/lib/readablePairs.test.ts` (PR #6314) holds each pair at 4.5:1 in both themes.
  Add the new pairs there.

## Plan

1. The investigation and the mock-up, then the owner's pick.
2. One PR: the constant, any token pair in `src/index.css`, the files above and the pin test, with a
   release note and a `docs/recent-features` fragment.

## How to verify

Sign in with `/dev-login?as=1` and open `/settings?tab=settings-what-everyone-sees`. Pick the
estimator, then Across → Every screen, then press **Check every screen** in light and in dark. No
Bids tab should show text under 3:1. A PR that touches `src/index.css` also runs the Lens report
workflow, which shows the before and after.

When the browser pane is hidden, CSS transitions freeze, so a button can read its old colour. Draw
one to three frames at a time on the dev server, and read the colours once they settle.
