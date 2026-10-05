---
name: "Submittals: an arrow from Resubmit back to the next revision"
number: 84
group: ready
status: >
  designed 2026-10-05 · not started. The owner drew the arrow on a screenshot and said "save to the
  punchlist for someone else to add it". Step 7's one button (v2.4555, v2.4556) is on main.
summary: >
  On the Submittals steps, a dashed arrow in the left margin runs from step 7 *Resubmit* up to
  step 2, with **Next revision** written vertically along it. It shows the loop the button starts:
  a new revision, then steps 3 to 6 again. Shown only while step 7 is the live step. Hidden on a phone.
next: Build it as one small PR — a kernel line for when it shows, one grid item on the road, a guide sentence.
size: XS
blocker: None.
opinion: build — small, and it answers a question the owner asked about his own screen.
---

# Submittals: an arrow from Resubmit back to the next revision

The before and after: [`submittals-next-revision-arrow-before-after.html`](submittals-next-revision-arrow-before-after.html), drawn in the app's tokens. Narrow the page to see the arrow go at phone width.

## The ask, in the owner's words

On a screenshot of BP375's steps the owner drew a red arrow in the left margin from step 7 up to step 2 and asked (2026-10-05):

> if this arrow existed visually, would it be accurate? Or would it go to 6 their call?

It is accurate. Pressing *Start a Rev 2 draft…* makes Rev 2 and selects it, so step 2 reads **Rev 2** and is ticked at once. The live step becomes 3, or 4 when no row owes a reason or a cut sheet. *Their call* for Rev 2 starts only after Rev 2 is shared. The loop is 7 → 2 → 3 → 4 → 5 → 6, and step 1 is skipped because the sources do not change. Then:

> should we add the arrow with a title like "next revision" vertically?

and, after the mock-up: "save to the punchlist for someone else to add it".

## The decision

Add it, with these limits (the reviewer's, shown to the owner with the mock-up; he did not change them):

- **Only while step 7 is the live step**, on the newest revision. Shown always, it would point at something you cannot do on a fresh Rev 1.
- **Dashed, in the blue of the "you are here" dot** (`#2563eb`). The solid rail already means "the order you work in"; a second solid line would read as part of it.
- **It ends at step 2's dot.** Not at step 3, although that is where the work resumes: the button's name is *Start a Rev N draft…* and step 2 is the step that carries the revision's name.
- **The label is "Next revision"**, the owner's words, written bottom to top. *Rev 2* was the other candidate; it was not picked. Do not lengthen it: sideways text is slow to read.
- **Hidden at 720 px and under.** There is no left margin on a phone. Step 7's own line already says a draft starts.
- **Decoration.** `aria-hidden`, no pointer events, not a control. The button and its line carry the meaning.

Open, the builder's call: whether a short loop should also show on Rev 2 and later to say "you came from Rev 1". Not asked for; leave it out unless the owner asks.

## Where it plugs in

- **The road** is a two-column grid in `src/components/bids/BidsSubmittalsTab.tsx` (`className="submittal-road"`, `gridTemplateColumns: '34px 1fr'`). Each `RoadSection` (`src/components/bids/SubmittalRoadSection.tsx`) is a fragment of two grid children: the rail cell (a 30 px dot, then a 2 px line) and the `<section>`. So every step is one grid row, and a step's dot sits at the top of its row with its middle 15 px down.
- **The arrow as one grid item** (what the mock-up does): add a first column of about 26 px, give the rail cell `gridColumn: 2` and the section `gridColumn: 3`, and place the arrow at `gridColumn: 1; gridRow: 2 / 7` with `marginTop: 15` and `marginBottom: -15`. Rows 2 to 6 end at step 7's top, so the extra 15 px reaches the middle of its dot. It stretches by itself as steps fold and unfold; nothing is measured. **Check the row count first**: steps 3 to 8 are drawn inside conditionals, so confirm that nothing else is a direct child of the grid between steps 2 and 7. If something is, give each `RoadSection` an explicit `gridRow` from its `n`.
- **The extra column only while the arrow shows**, or always? Always is simpler and keeps the steps from shifting 32 px sideways when rows come back. The mock-up adds it only with the arrow; prefer always, and check the phone width keeps today's two columns.
- **When it shows**: `stageStatus('resubmit') === 'current' && isNewest` in the tab. Put the rule in `src/lib/submittals/submittalJourney.ts` beside `stageGate` as a small exported function with a unit test, per the repo's kernels-first rule.
- **Styles**: a class in `src/index.css` (the tab's phone rules live there under `@media (max-width: 720px)`, e.g. `.sub-rows-table`). The blue is a saturated status color and stays literal; the label's background must be `var(--surface)` so it reads in the dark theme.
- **Words**: `Next revision` is a label, not a sentence. If the walkthrough's *Step 7. Resubmit* stop (`src/lib/submittals/submittalTour.ts`) gains a sentence about the arrow, it follows the plain-words rules. The guide `src/content/help/build-a-submittal-package.md` gets one sentence where it describes the button.

## The plan

One PR, the usual train (claim a version, release note, fragment):

1. `showNextRevisionLoop` (or the like) in `submittalJourney.ts` with its test.
2. The grid column and the arrow item in the tab and `SubmittalRoadSection.tsx`; the class in `index.css`.
3. The tab's render test: the arrow is there when rows were sent back on the newest revision (the 2026-10-03 "a resubmit carries the rows nobody answered" case has that shape), and absent on a fresh Rev 1 and on an older revision.
4. The guide sentence. Then delete this to-do and its mock-up.

## How to verify

- **BP375** (SpaceX, read only) has the shape today: Rev 1 with 4 rows sent back and 10 with no answer, so step 7 is the live step and the arrow should show. Open it at `/bids?tab=submittals&bidId=7e5ea6e5-1eff-4130-b18c-89e33b9465fb`. Do not press *Start the draft* there.
- Fold and unfold steps 3 to 6 and tick **Open every stage**: both ends must stay on the middles of dots 2 and 7.
- At 720 px and under the arrow is gone and the steps keep their two columns. The Browser pane fires no media events on resize, so reload after resizing.
- Dark theme: the label's background matches the page behind it.
- **BP398** "ZZ Test" is the bid to write on, if a full loop is wanted: start the draft there and watch the arrow go once step 7 is no longer the live step.
