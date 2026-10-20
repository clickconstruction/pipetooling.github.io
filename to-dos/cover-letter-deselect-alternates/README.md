---
name: "Cover letter: deselect alternates on the letter itself"
number: 138
group: gated
status: proposed 2026-10-20 — nothing built; mock-up rendered
summary: >
  Wendi: "i want the ability to deselect alternates from the cover page in click tooling."
  On a bid with no versions, a price offered to the GC rides the letter as an alternate, and the
  studio's only advice is "manage offers on the Pricing tab" — the one alternate kind with no
  checkbox in Step 1. PR 1 gives that branch the same offer rows the other two kinds already
  have; PR 2 puts a "Take off this letter" button in the preview's wording editor. Both write
  the one flag everything already reads.
next: The owner's go on the two PRs and the five calls below.
size: S each
blocker: The owner's go.
opinion: build — the gap is one branch of Step 1, and every write it needs already exists in the tab
---

# Cover letter: deselect alternates on the letter itself (#138)

## The ask, in her words

Estimator Wendi, relayed 2026-10-20: *"i want the ability to deselect alternates from the cover
page in click tooling."* Her screen was the Cover Letter studio on a sent bid whose letter listed
two alternates with the **same amount** — a price scenario and its copy, both offered — printing
as *Alternate 1: Add $57,012.16* and *Alternate 2: Add $57,012.16*. Step 1 read *One bid — the
letter shows ★ WENDI, plus Default, Default copy offered as alternates — manage offers on the
Pricing tab.* There is nothing to click there; the offer switch lives on another tab, on the
price card's bottom bar.

## The three lenses

- **Her seat.** She is grooming the letter with the preview beside her. The alternates she wants
  gone are named in Step 1 and printed in the preview, but neither spot can remove them — she has
  to leave the letter, find the right price card on the Pricing tab, and come back. Fewest taps:
  untick it where she reads it.
- **The job behind the ask.** Offers accumulate on a bid: the Pricing tab's **＋ Add price** door
  offers the new price *by default* (its checkbox "Offer it to the GC as an alternate right away"
  starts checked — right for that door's purpose, another price **for the GC**), so a copy made
  only to compare rides the letter. A duplicate alternate line in a contract document makes the
  company look careless, and every alternate on the letter is a price the GC can hold us to. The
  real job: the letter shows exactly what she chooses to offer, and the choosing happens where
  she can see the letter.
- **The whole office.** Three kinds of alternates reach a letter, and two already have checkboxes
  in Step 1: a split bid's packets and their offered prices (v2.2117 / G1 v2.2154), and the
  with-and-without group alternates (v2.4195, "Offer <group> ALT" rows). Only the version-less
  bid's offered prices have no control — and that is the most common bid shape. The deselect must
  write the one flag everyone reads (`price_book_versions.include_in_submission`): the bid room's
  options, the Approval PDF's letter, the Version picker's "in letter ✓" badge and the Pricing
  card's *On their letter · alternate* caption all follow it. A letter-only hide would split the
  truth between tabs.

## The decision (proposed)

Two small PRs, both client-only — no migration, no edge function.

**PR 1 — offer rows in Step 1's version-less branch.** Where today a sentence names the offered
prices and points at the Pricing tab, list the bid's other prices the way the split-bid branch
already lists a version's other prices (`otherPrices`, the checkbox at `setScenarioOffered`):

- One row per non-★ price of the bid: a checkbox (offered / not), the name with ✎ rename
  (`commitRenameOption` — the panel's name; the letter's own wording stays the preview's dashed
  click-to-edit, since a standalone offered price prints as a bare *Alternate N* until written),
  and the caption the versions branch uses — *alternate · $54,990.00* / *alternate · unpriced —
  left off the letter* / *not offered*.
- The ★ base keeps its sentence (*One bid — the letter shows ★ MARCY*); it is the letter, not an
  offer.
- **The same-amount nudge**: when two offered alternates land at the same amount (or an alternate
  matches the base, which already prints *no change*), the row gets an amber note — *same amount
  as "Copper water lines" — probably a copy*. That is the exact shape of Wendi's screen.
- Unticking the last alternate returns the plain single letter (`planUnsplitLetterSections`
  already returns nothing when no price is offered).
- The guide *use the cover letter studio* (`try-the-new-cover-letter-layout.md`) rewrites the
  ":::example One GC, one price?" box and loses "manage offers on the Pricing tab".

**PR 2 — "Take off this letter" in the preview's wording editor.** The preview's alternate lines
are already click-to-edit (`data-cl-edit` → `altTextEditor`). Add one button beside Save / Cancel /
Reset: **Take off this letter**, shown **only when the line is an alternate** — never on a base
or option section, never on the heading. It routes by the edit key to the write that kind already
has:

- an offered price (`<versionId|none>:<pricingId>`) → `setScenarioOffered(p, false)`;
- a group alternate (`group:<tag>`) → `groups[key].offered = false` in `cover_letter_alt_texts`;
- an in-lieu packet (a bare version id) → `toggleVersionInclude` off, same as its checkbox.

The letter repaints; the row in Step 1 reads *not offered* (or unticks), so the way back is
visible. This is the literal ask — deselect **from the cover page**.

## The calls that are the owner's

1. **Build both doors, or just the panel?** Default: **both** — PR 1 is the discoverable,
   symmetric fix; PR 2 is the ask as spoken.
2. **What a deselect means.** Default: **stop offering** — write the same
   `include_in_submission` flag the Pricing tab's card toggles, so the letter, the bid room, the
   Approval PDF and the Pricing card never disagree. Rejected: a letter-only hide in
   `cover_letter_alt_texts` (two truths; the Pricing card would still say *On their letter*).
3. **Do unticked prices stay listed in Step 1?** Default: **yes**, as *not offered* rows — one
   click to re-offer, and a junk copy stays visible until someone deletes it on the Pricing tab.
4. **The ＋ Add price door's "Offer it right away" default.** Default: **keep it checked** — that
   door exists to offer, and with PR 1 a wrong offer is one click to take back. Alternative:
   start unchecked (quieter letters, one more step on the normal path).
5. **The same-amount nudge.** Default: **include in PR 1** — it names the exact mistake on
   Wendi's screen. Alternative: drop it (the checkbox alone fixes her day).

## Where it plugs in

Everything is in `src/components/bids/BidsCoverLetterTab.tsx`; anchors are symbols, not lines.

| Piece | Exists | New |
|---|---|---|
| The version-less branch (`bidVersions.length === 0`, the v2.2392 sentence) | the sentence naming offered prices | the offer rows replace the "manage offers on the Pricing tab" clause |
| `setScenarioOffered` (the tab's own, G1) | writes `price_book_versions.include_in_submission`, reloads | reused as-is by PR 1's checkbox and PR 2's button |
| `commitRenameOption` / `renameEditBox` | rename an offered price | reused for ✎ on the new rows |
| Group alternate rows (`addAltRows`, v2.4195) | checkbox + ✎ pattern to mirror | — |
| Wording editor (`altTextEditor`, Save / Cancel / Reset) | opens from `data-cl-edit` spans | the **Take off this letter** button + kind routing on the edit key (`altSectionKey` shapes) |
| `planUnsplitLetterSections` (`coverLetterVersionBundle.ts`) | offered unsplit prices as alternates; empty when none | — (no kernel change) |
| `buildAlternatesBlock` / `formatAlternateDeltaText` (`coverLetterSamePage.ts`) | *no change* when an alternate matches the headline | the same-amount-as-sibling check (small pure helper + test) |
| Readers of the flag | bid room (`roomSectionsForPacket` off `pricedBundle`), Approval PDF (`approvalPdf.ts`), `BidVersionPicker` badge, `PricingCardsRow` caption | — they follow automatically |
| Guide | `src/content/help/try-the-new-cover-letter-layout.md` | the Step 1 words; `offer-an-alternate-on-a-bid.md` already matches (group alternates had the checkbox) |

A sent bid is no special case: the Pricing tab's toggle already changes a live room today, and the
send record (`bid_date_sent`, `bid_value`, `bid_version_sends`) is stamped, not recomputed.

## The plan

1. **PR 1** — the offer rows + the same-amount nudge (pure helper in `coverLetterSamePage.ts` with
   a unit test), a tab render-test case (the version-less branch shows the rows; unticking writes
   the flag), the guide words, release note + fragment.
2. **PR 2** — the editor button + kind routing, a render-test case per kind (price / group /
   packet; none on a base or the heading), one guide sentence, release note + fragment.

## How to verify

On a ZZ test bid (or b464 *ZZ Takeoffs Test*): Pricing → **＋ Add price** twice from the same
scenario (leave "Offer it right away" checked) → Cover Letter shows two alternates and the
same-amount note → untick one (row reads *not offered*; the letter repaints to one alternate;
the Pricing card's caption flips to *not offered*; the bid room preview loses the option) →
re-tick (everything returns) → click the remaining alternate's dashed wording in the preview →
**Take off this letter** → the plain single letter returns. Check the versions branch and a
group alternate still behave (their checkboxes predate this). Live recipe: the dev-login mint +
Playwright harness in the `live-test-recipe-prod` memory; nothing here needs psql.

## Where it stands

Proposed 2026-10-20 from Wendi's report, the same day. Mock-up beside this file
(`mockup.html`), rendered with Playwright at desktop and phone widths before it was shown.
Nothing is built.
