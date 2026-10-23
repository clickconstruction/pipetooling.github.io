---
name: "Pipeline: a quieter owner-sees signal — a crossed eye with a hover card in place of the ☐ owner sees $0 chip"
number: 145
group: gated
status: proposed 2026-10-23 · mock-up drawn, three options · waiting on the owner's pick
summary: >
  On a GC-billed job whose customer is the property owner, the Pipeline row carries a pill beside
  the owner's 🌐 that reads ☐ owner sees $0, ☑ owner sees the bills or owner sees some bills
  (v2.3827). It is the switch that puts the GC's open bills on the owner's portal for their
  records. The owner finds the words confusing and the pill wasteful, and asked for mock-ups of a
  quieter signal, perhaps a crossed eye with a hover card. This folder holds the row as it is
  today and three options at real row height, and picks one.
next: the owner picks A, B or C from the mock-up; then one PR
size: S — one PR, client only, no migration
blocker: the owner's pick
ver: proposed
opinion: build A — the crossed eye is the owner's own instinct, it says the one true thing (not on their page) in the row's own glyph language, and the card carries the figure with its label and the door
---

# Pipeline: a quieter owner-sees signal (#145)

## The ask

The owner, 2026-10-23: "I think that the 'owner sees $0' is confusing and takes up valuable real
estate. And I would like a better way to present this. Can you offer me some mock ups of options
and what it could look like? I still think it's valuable to communicate this idea. I just don't
like how it's presented. Perhaps we should show an eye with a line through it where when the user
hovers over it, they can get details about what that means in the form of a temporary modal."

## What the words mean today

The pill is **not** the Stage Plan's eye. It is the *owner sees the bills* switch from v2.3827
(punch list #45, `to-dos/owner-portal-property-view/`, since retired). It shows only on a job that
is **billed to the GC** while its **customer is a different party**, the property owner
(`ownerShareApplies` in `src/lib/jobs/ownerBillShare.ts`). On such a job the owner's portal lists
nothing, since they pay none of the bills, so their page reads **$0** and *all paid up* while the
GC owes on their house. That is the fact the pill reports, and the incident behind it: Umar Khan's
portal reading *You're all paid up* with $30,387 open on 9703 Lenox Hl (2026-09-25).

Its three states (`ownerShareState`): **off** (nothing shared), **on** (the job's memory
`show_bills_to_other_party` is set and every open GC bill is stamped `shown_to_party = 'customer'`),
**partly** (one without the other, from a hand tick at Bill Customer or Edit Job's older
*next bills* tick). A click reads every job at the property with the same owner and asks *Show
Umar Khan the bills at 9703 Lenox Hl?*, listing each job's open bills; *Show them* stamps them all
and sets each job's memory, *Stop showing* takes the open ones back. Shared bills reach the
owner's page with no Pay button and never in their balance. Once a § 53.056 notice to the owner is
recorded, their page shows the notice card on its own and the switch is no longer needed for that.

So "$0" is not the job's money and not the GC's balance. It is what the owner's portal would show
them of this job's money right now: zero, because the bills are the GC's and none is shared.

## The real estate, honestly

Measured on the live Pipeline 2026-10-23 (80 rows, 23 with the pill, 17 on, 6 off):

| Width | The pill | Customer line wraps | Sets the row's height |
|---|---|---|---|
| 1440 px | 110–140 px wide, 19 px tall | 0 of 23 rows | never — the Progress cell or the actions column is taller on every row |
| 1180 px | same | 18 of 23 rows (+18 px in the identity block) | rarely — the identity block came within 10–15 px of the tallest cell on the Working rows |

So on a desktop the pill costs no height. What it costs is **width**: the identity block sizes
itself to the unwrapped customer line (v2.5630), so the pill widens it by 56–71 px and the notes
box beside it shrinks by the same (the mock-up draws this: 256–271 px with the pill, 200–211 px
with the glyph); on a laptop the line wraps under the name on most rows instead. And it costs
**attention**: a bold, bordered pill with a dollar figure on 23 of 80 rows, where every other
figure on the row has a label and this one has a sentence that reads like a money fact. The
confusion is the words, not the pixels. A quieter signal fixes both.

## Three options (the mock-up draws each at real row height)

**Today** — ☐ owner sees $0 · ☑ owner sees the bills · owner sees some bills, in the customer
line's tail after the 🌐 and the speech bubble.

**A — a crossed eye in the icon run, with a hover card.** One 15 px glyph after the bubble, the
Stage Plan's own eye (`EyeIcon` in `JobFormStagesGroup.tsx`, where the eye already means *on the
portal*): a crossed eye when the owner's page shows none of the bills, an open eye when it shows
them, an open eye with a hollow pupil when it shows some. Grey when there is nothing to show yet
(no bill is out), **amber when open bills exist that the owner cannot see** — the one case worth a
glance, the Umar Khan case. Hover or focus opens a card a beat later (the Lien calendar's
`LienMarkHoverCard` pattern, v2.5531), a tap opens it on a phone: what the owner's page shows,
why, the open figure with its label, and the door — *Show Dana the bills ›*, which opens the
switch's existing window. Esc or leaving closes it.

**B — the glyph, and the figure beside it only when it is not $0.** The same eye; when the owner
sees the bills the open figure sits beside it in blue (*👁 $9,200*), when they see some, amber
(*👁 $4,600 of $9,200*); $0 is the glyph alone. Same card on hover.

**C — the figure folded into the money line.** Nothing in the customer line. The Progress &
payment cell's last legend line carries a muted fragment: *Left on Job $5,700 · owner's page $0*.
No new line while it fits; the cell is already the row's tallest on most Billed rows, so when it
wraps it adds 18 px to the row. The fragment is a door to the same window.

## Is this the best we can do? Are we being straightforward?

- **The pill was built to be loud on purpose.** The owner's page saying *all paid up* over $30k
  open is the thing the office must not miss. A grey glyph could hide it. So A's glyph is not one
  colour: it is grey only when there is nothing to show yet, and amber the moment open bills exist
  that the owner cannot see. The loud case stays loud, at 15 px.
- **Two eyes, one meaning.** The Stage Plan's eye (Edit Job → Stages) already means *the GC sees
  this on the portal*. A's eye means *the owner sees this on their page*. Same glyph, same meaning,
  and the card names bills, so the two never collide. That is a reason for the eye over a new
  glyph.
- **B's bare number.** *👁 $9,200* in the icon run is shorter than today's pill, but it is a figure
  without a label, beside a money cell where every figure has one. The reader asks the same
  question the owner asked of *$0*. The figure belongs in the card, next to its words.
- **C adds height where A removes it.** The money cell is the tallest cell on most Billed rows; a
  fragment that wraps there grows the row. And a muted fragment in a legend is not a door anyone
  finds. C fails the owner's real-estate test on the rows that matter most.
- **The off state is the common state for new jobs.** Most GC-billed jobs start off. A card that
  opens on hover is enough; the office never needed to read the pill on every row, only to act on
  the amber ones.
- **What the card must say.** The current popover's words assume the reader already knows what the
  switch is. The card says the fact first: *Nia Okafor's page shows $0 of this job.* Then why.
  Then the door. Plain words, one idea a sentence.

## The pick

**A.** It is the owner's instinct, and the critique holds up: the eye already carries this meaning
in the app, the amber rule keeps the Umar Khan case visible, the card gives the figure its label,
and the row's customer line stops wrapping on a laptop. B is A with the number moved out of the
card for no gain. C costs height and buries the door.

## Where it plugs in

- `src/lib/jobs/ownerBillShare.ts` — `ownerShareApplies`, `ownerShareState`, `ownerShareBills`
  (the open GC bills), `ownerShareChipWords` (retired by this PR; the card's words take its place
  as a new kernel beside it, `ownerSeesCard.ts`: the glyph's state and tone, the three sentences,
  the door's words).
- `src/components/jobs/OwnerShareChip.tsx` — becomes the glyph with the card; the popover it
  already opens stays as the door's window.
- `src/components/jobs/jobsStagesRowShared.tsx` → `renderJobCustomerLine`, the
  `customer-line-tail` unit (v2.4151) — the glyph takes the pill's slot.
- `src/components/customers/CustomerPortalGlobeButton.tsx` → `PortalOwnerShareSection` — the
  portal window's per-property line uses the same chip today; it keeps the words there, where
  there is room, or takes the glyph with the figure beside it (B's shape fits a list).
- `src/components/jobs/JobFormStagesGroup.tsx` → `EyeIcon` — lift it to `src/components/icons/`
  so both surfaces share one eye.
- The guide `src/content/help/show-an-owner-the-bills-their-gc-pays.md` names the pill's words
  and its chips; the glossary's *Share this bill* entry names the chip.

## The plan — one PR

1. `ownerSeesCard.ts` kernel (state → glyph, tone, sentences, door) with tests on the four
   states and the amber rule.
2. `OwnerShareChip` → the glyph; the hover card (hover, focus and tap; Esc closes); the door
   opens the existing window unchanged.
3. The guide and the glossary entry amended in place; a release note and the fragment.

## How to verify

- `npx vitest run src/lib/jobs/ownerBillShare src/components/jobs/JobsStagesTable src/components/jobs/JobsStagesUnifiedTable`.
- Live, read-only: `/dev-login?as=1&to=/jobs?tab=stages`, search *Lenox* — the rows that read
  ☑ today show the open eye; search a GC-billed job with an open bill and the switch off for the
  amber crossed eye. Hover each, read the card, press Esc. On a phone width, tap.
- The switch itself is unchanged: the door opens the same *Show … the bills at …?* window.
  Do not press *Show them* on a live row.
