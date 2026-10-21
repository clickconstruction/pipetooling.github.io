---
name: "Cover letter: address the letter to any GC on the bid"
number: 133
group: close
status: built 2026-10-20, both PRs on main 2026-10-21 — owner's go ("Build it") on the recommended defaults; PR 1 the Addressed to row v2.5679 (#5919) and PR 2 Print all v2.5685 (#5928) merged; PR 3 falls away under the defaults (same-letter sends ride the bid, the room folds); left: the ZZ Test live walk, then delete the folder
summary: >
  Grace: when she makes the cover page the letter is addressed to the bid's first GC only, and for
  every other builder on the proposal she retypes the name by hand after pasting. The bid already
  records every builder it goes to — the Send to strip's packets and the "Also sent to" same-letter
  list — but a same-letter GC's letter is never actually produced with their name on it. The fix is
  an "Addressed to" row on the Cover Letter: one chip per GC on the bid, the letter's name-and-address
  block follows the selected chip, a + GC chip records a new builder right there, and Print / Copy
  carry the addressed copy. Nothing else changes: same prices, same amount, same tracking. A
  follow-up PR adds "Print all — one letter per GC".
next: >
  The owner said "Build it" on 2026-10-20 — the three calls go by their recommended defaults:
  same-letter copies ride the bid's one sent date, the room folds to a note while one is
  addressed, and the row serves split bids too. PR 1 (v2.5679) builds the row; PR 2 adds Print
  all, one addressed letter per GC with page breaks; then the ZZ Test live walk from How to
  verify. Per-recipient sends or rooms (the old PR 3) return only if real use asks for them.
size: M (PR 1 the Addressed to row) + S (PR 2 print all) + S (PR 3 per-recipient sends or rooms, gated on calls 1–2)
blocker: None.
---

# Cover letter: address the letter to any GC on the bid

Mock-up: [`mockup.html`](./mockup.html) — the Cover Letter studio's step 1 in three states: the new
**Addressed to** row with the bid's GC selected, the same letter re-addressed to a same-letter GC,
and PR 2's **Print all**. All data made up (Ridgeway Builders / Harbor Point Construction / Cedar
Bend Medical Office).

## The ask

Grace (estimator), 2026-10-20: "I want an option to change the GC who is receiving our proposal
when making the cover page for a proposal on a bid. Right now it's only letting me choose the first
one and I have to manually imput the other GC(s) on the proposal if there is one."

## What exists today — and the exact gap

The multi-GC system (v2.1159 → v2.2407) already models everything except the address block:

- **Send to strip** (`BidVersionPicker.tsx`): one group per GC. A GC with versions of their own is
  a **packet** — own prices, own sends, own answer. On a **split** bid the Cover Letter's GC tabs
  pick whose letter you write, and that letter is headed with their name and address
  (`coverLetterGcPackets.ts`, help guide `bid-one-project-to-multiple-gcs`).
- **Same-letter GCs** (`bid_gc_recipients`, v2.2163/v2.2383): builders on the bid's "Also sent to"
  list with no packet. They ride the bid — the bid's sent date, the bid's answer. The strip shows
  them dimmed with **track separately**; Edit Bid shows them as GcCards.
- **The gap**: the letter's addressee is resolved by `resolveSingleLetterGc` /
  `letterDocument` (`coverLetterDocument.ts`) as *the active version's GC override, else the bid's
  GC*. Same-letter GCs are never offered. So on Grace's bid — one packet, a second GC riding as
  "same letter" — the preview, Print and Copy always print the first GC's name, and the app never
  actually produces the letter the "same letter" chip claims the second GC got. Grace pastes into
  the Google Docs template and retypes the other builder's name by hand, per GC, per revision.

The only in-app way to re-address today is **track separately** (＋ Add GC), which forks a whole
packet — its own prices to maintain — when all she wants is the same letter with a different name
on it. That is exactly the case "same letter" was built to record.

## Three lenses

- **Grace's seat**: she is on the Cover Letter, letter done, and needs N addressed copies. Today
  that is N−1 hand edits outside the app, re-done every time the amount changes. It should be one
  click per GC, zero retyping.
- **The job behind the ask**: several builders bid the same project; the sub sends each one the
  same proposal, properly addressed. Every copy differs only in the address block. The moment of
  addressing is also the moment the office should record who got the letter.
- **The whole office**: follow-up calls, the Bid Board's per-GC lines and won/lost all hang off
  the bid's recipient records. A letter hand-retyped in Google Docs is invisible to all of it. The
  design below makes the tracked list the only path to an addressed letter — addressing a new
  builder records them on the bid as a side effect, instead of the record being optional homework.

## The design (PR 1)

**Addressed to** — a chips row in the studio's step 1, where the static "To {GC}" caption sits:

- One chip per GC the bid goes to: the bid's GC (★, default), then every same-letter GC (dashed,
  "same letter" sub-caption), then **+ GC**. The row only renders when there are two or more, so
  single-GC bids change nothing (the per-GC system's standing guarantee).
- Selecting a chip swaps **only the letter's name-and-address block** — preview, Print, Copy, and
  the Google Docs copy flow all follow (they already read one `letterCustomer`). Amount, prices,
  fixtures, wording: untouched. A caption says so in plain words: "Harbor Point Construction gets
  the same letter as Ridgeway Builders. Only the name and address change."
- **+ GC** opens the same tick-list picker Edit Bid uses (`BidGcRecipientsRow`: search, tick
  several, ＋ New GC stacked) and writes `bid_gc_recipients` manual rows — "manually inputting the
  other GC" becomes recording them properly, right where she is working. The strip, Edit Bid,
  Followup and the board see the new rider immediately, as they do today.
- **Honest send line** while a same-letter GC is addressed: their copy rides the bid's one sent
  date (the board's first-send rule, v2.2407); Mark sent stays the bid's button with its existing
  caption. **track separately** stays one click away for a GC who needs their own prices.
- **Bid room**: the room panel is per-GC and a same-letter GC has none; while one is addressed the
  panel folds to a one-line note (call 2 below can upgrade this to per-recipient rooms later —
  rooms carry opens and signatures, so two builders must not share one).
- On **split** bids the existing GC tabs row absorbs the same-letter chips (call 3): one row, one
  model — "the tabs pick whose letter you are writing" — packet GCs switch the packet as today,
  same-letter chips re-address the bid-default packet's letter.

**Rejected on purpose**:

- *Free-text name/address override on the letter* — produces untracked letters; the records and
  the paper drift apart.
- *Making "track separately" the answer* — forking prices to change an address block is the wrong
  tool, and doubles her pricing upkeep.
- *Addressing a customer without recording them on the bid* — same drift; the picker records as it
  addresses, every time.

## Where it plugs in

| Piece | Exists | New |
| --- | --- | --- |
| `bid_gc_recipients` + `customers` join | yes (strip + Edit Bid load it) | the Cover Letter tab loads it too (name + address) |
| `src/lib/bids/coverLetterGcPackets.ts` (`resolveSingleLetterGc`) | yes | — |
| `src/lib/bids/coverLetterAddressees.ts` | — | new pure kernel: addressee list (bid GC + manual recipients + packet GCs), effective address block for a selection, row-visible rule (≥2) |
| `BidsCoverLetterTab.tsx` | `letterCustomer` already feeds every builder (preview/Print/Copy/Docs) | `addressedGcId` state (reset per bid) overrides `letterCustomer`; chips row; captions; room fold |
| `BidGcRecipientsRow.tsx` tick-list picker | yes (Edit Bid) | extract the picker so the + GC chip reuses it |
| `src/lib/bidDocuments/coverLetter.ts` | takes name/address params | — (PR 2 reuses `buildCombinedCoverLetterDocument` for one-letter-per-GC) |
| Help guides | `bid-one-project-to-multiple-gcs`, `try-the-new-cover-letter-layout` | both gain the Addressed to row; §"Also sent to" says the letter can now actually be printed for them |
| Migrations | — | none in PR 1–2; PR 3's `sent_on` on `bid_gc_recipients` only if call 1 goes that way |

Out of scope, noted so nobody re-derives: the Approval PDF / signature flow plans its letter
through the same `letterDocument` but has its own send path — re-addressing it follows the same
`letterCustomer` thread if PR 1 lands the override upstream of both; verify in PR 1's walk. RFQs
to subs (`RfqComposeModal`) are a different surface.

## The plan

- **PR 1 (M)** — the Addressed to row: kernel + tests, chips UI, re-addressed preview/Print/Copy,
  + GC picker reuse, honest captions, room fold, help-guide updates, render smoke
  (`BidsCoverLetterTab` has three render suites to extend). No migration.
- **PR 2 (S)** — **Print all / Copy all** when 2+ addressees share the letter: one document, page
  break per GC, each copy addressed; buttons say the count ("Print 3 letters — one per GC"). A GC
  with no address on file still prints (name line alone) — nothing holds the batch; the chip shows
  "no address on file" as its reason and its door is the customer card.
- **PR 3 (S, gated on calls 1–2)** — per-recipient send stamps (`sent_on` on `bid_gc_recipients` +
  chips/board/followup read it) and/or per-recipient rooms.

## Calls that are the owner's (defaults proposed)

1. **Same-letter sends** — keep riding the bid's one sent date (recommended: keeps the v2.2407
   one-rule and PR 1 migration-free) vs a send stamp per recipient (PR 3).
2. **Rooms** — fold the room panel to a note while a same-letter GC is addressed (recommended) vs
   a room per recipient (PR 3; rooms carry opens and signatures, so sharing one is not an option).
3. **Split bids too** — same-letter chips join the GC tabs on split bids (recommended: one model
   everywhere) vs unsplit bids only (Grace's literal case).

## How to verify

- ZZ Test bid with one packet + two same-letter GCs (add via Edit Bid's + Add GCs): preview flips
  the address block per chip; Print and Copy carry the selected GC; the Google Docs copy pastes
  with the right name; Mark sent still stamps the bid once; the strip, board and Followup rows are
  unchanged by addressing.
- Split ZZ bid (two packets + one same-letter rider): packet tabs still switch packets; the rider's
  chip re-addresses the bid-default letter only.
- Single-GC ZZ bid: no row renders anywhere.
- Live-test recipe + dev-login mint per the usual prod walk (memory: live-test-recipe-prod);
  delete the ZZ rows after.

## Where it stands

Proposed and approved 2026-10-20 (owner: "Build it", recommended defaults stand). PR 1 (v2.5679,
#5919) built the same day and merged 2026-10-21: the kernel + 7 tests, the
Addressed to row with + GC and the honest note, the room fold, the Print/Copy sub-lines, the
`bid-default` tab-key translation fix, both help guides. PR 2 (v2.5685, Print all) built on
`claude/cover-letter-print-all-pr2` and merged 2026-10-21 (#5928): the no-heading copies
document, the per-addressee letter builders, the "no address on file" chip flag. Then the ZZ
Test live walk from How to verify.
