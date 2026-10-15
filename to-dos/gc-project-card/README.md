---
name: "GC projects: a project's card that reads in the order the questions come"
number: 108
group: gated
status: mock-up drawn 2026-10-14, waiting on the owner's yes (and his six calls under *Is this the best we can do?*); no branch, no claim, nothing built
summary: >
  The owner's screenshot of a bidding project's card on GC projects: "very chaotic and not very
  intuitive". The card is nine parts in one column at one size with no headings, the doors to
  its windows as a wrap of blue words in the head, two colour keys, the stage's end in the
  middle, and every trade said three times. The mock-up draws it today, then three shapes (one
  column in bands, a rail on the right, tabs) and a refined cut (D) that reads in the order the
  office asks its questions: on track? next? how long? which trades, who to call? where are the
  plans? The critique weighs the three and lists the owner's calls.
next: The owner reads mockup.html and answers the six calls at its foot. On a yes, the building-stage card gets its own mock-up before any build, then the four-PR train.
size: M (four PRs, each S or M; the building-stage mock-up first)
blocker: The owner's yes, and his six calls.
opinion: build D — A, B and C each lost on one thing D keeps (the calendar in view, one reading order, nothing hidden), and every word and number on D comes from kernels that exist.
mockup: to-dos/gc-project-card/mockup.html
---

# GC projects: a project's card that reads in order

## The ask

The owner, 2026-10-14, with a screenshot of the bidding project's card under **Each project**:
"This feels very chaotic and not very intuitive. Could you please help me come up with a
solution to improve this? Maybe come up with multiple mock ups and then think deeply and ask
yourself, is this the best we can do?"

## What is wrong today

The card (`src/pages/GcProjects.tsx`, the `loaded.projects.map` from line 2048) is nine parts
in one column, everything at 0.85rem, no headings:

1. **The head** mixes the name, stage, address and due day with every door to a window as
   quiet blue buttons in one wrap (The plans, Papers, Questions, A new set of plans came in,
   Schedule, the sq ft, Our number, Bid tabs; on a building job also Change orders, Daily log,
   Punch list, Submittals, RFIs, Draws, Closeout, Get started, Bill the customer, Bill day).
2. **The stage strip** (`GcStageHealth.tsx`): the stage rail, then the verdict and Next, then
   the clock line, then the three-week calendar with a seven-entry key, then a tile a trade
   with a five-entry key, then the three numbers. The verdict comes third and the summary
   numbers last, after the detail they sum up. The keys take as much room as what they explain.
3. **The outcome** (`GcProjectOutcome.tsx`): We sent our bid · We won this. Start buyout (blue)
   · We lost this, mid-card, the blue fighting the Next button.
4. **The plans** as a sentence, then **Drive** as a line of links with the access check inside it.
5. **The trades**: a heading (name, budget, N scope lines, Save as a set), the scope bullets, the
   statement of work once awarded (`GcTradeSow`), and the companies asked with their state,
   Will not do it / Cannot do it, the promises, Log a contact and the log (`GcTradeAsks` and
   `GcAskThread`). So each trade is said three times: tile, heading, companies, with nothing
   tying them.

## The decision (pending)

The mock-up holds today's card (0), **A** one column in bands, **B** a rail on the right,
**C** tabs on the card, and **D**, the refined cut. The critique at its foot weighs A, B and C:

- **A** is most of the answer (bands with headings, trade rows, keys behind a link, the outcome
  in the foot) but kept the rail and the clock caption as bands and the head's facts as a run-on.
- **B**'s grouped doors with a fact on each are kept; its second column is not (two reading
  orders, the calendar squeezed, collapses to A on a laptop).
- **C** hides the calendar the owner asked for and hides holes behind a tab.
- **D** takes the bands and rows from A, the doors and More ▾ from B, the numbers-with-the-verdict
  from C, and on its own tints the verdict band, drops the stage rail (said three times) and
  names the customer and the architect in the head.

Open calls for the owner, in the mock-up's last section: the stage rail (drop or a grey
caption), where the stage's end lives (the foot, or More ▾, never a blue button beside Next),
the keys (a link for a month, then gone), the trade table's columns and whether Budget shows at
all, the customer and architect in the head, and the building-stage card, which gets its own
mock-up before any build.

## Where it plugs in

- `src/pages/GcProjects.tsx` — the card from line 2048: the head's buttons, the strip, the
  outcome, the plans and Drive lines, the trades' loop.
- `src/components/gc/GcStageHealth.tsx` — the strip; its kernel `src/lib/gc/stageHealth.ts`
  (`health.verdict`, `why`, `next`, `calendar`, `tiles`, `numbers`, `bars`).
- `src/components/gc/GcProjectOutcome.tsx` — the stage's end.
- `src/components/gc/GcAskThread.tsx`, `GcTradeSow.tsx` and `GcTradeAsks` (in the page) — what
  opens under a trade row.
- Nothing new is computed: the words and numbers on D come from `stageHealth`, `priceStanding`
  (Our number's "so far"), `followUp` (people to call) and the project's own rows.
- Decided by the owner before this (keep): the stage-health visual at the top (2026-10-04), the
  day calendar (2026-10-04, 2026-10-05), the numbers with a hover "much like the circle", the
  outcome buttons on the head (call D, 2026-10-03), the tiles' saturated colours.

## The plan, if D is a yes

The building-stage card's mock-up first (the busiest card: the work and money bars, the buyout
dots, ten doors). Then four PRs, each shippable alone:

1. **The head**: the facts line (address, size, customer, architect, due day with days left), the
   doors as two grouped sets with a fact on each, More ▾ for the rare presses and the
   building-stage windows. `GcProjects.tsx` only.
2. **The verdict band** inside `GcStageHealth`: tinted by the verdict, Next on the right, the
   numbers moved up under it (days left as one of them), the rail folded to a caption or gone.
3. **The trade table**: one row a trade (stripe, name and budget, scope, quotes, asked, next),
   the tile and the asks folded in, › opens the scope and the threads, keys behind a Key link.
   A new `GcTradeRows.tsx` over the rows `GcTradeAsks` and `GcAskThread` already read.
4. **The plans band and the foot**: the set, sheets, link check and folder in one band; the
   outcome as plain buttons under *When the bid ends*.

Each PR: a render smoke on the words that moved, a release note, a fragment, the page map's
GcProjects section amended, the *GC projects* guide's screenshots refreshed where a stop moved.

## How to verify

Live, as a dev on `/bids/gc` with the GC test projects ("GC test bidding project, delete me"
under Bidding, "GC test project, delete me" under Building), read only; then as an assistant
through *imitate (localhost)* to see the card without the money team's doors and numbers.
