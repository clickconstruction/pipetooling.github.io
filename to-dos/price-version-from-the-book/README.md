---
name: "Pricing: price a fresh version from the book, right in the Workbench"
number: 135
group: close
status: built 2026-10-20 on the owner's go, all four defaults taken — PR 1 v2.5687, PR 2 v2.5689, PR 3 v2.5690; merges + the live walk left
summary: >
  Wendi: on a side-by-side rebid she makes a second version with its own counts, and the newer
  Pricing view gives her no way to price it — only "Copy the base price" (wrong: the counts
  differ) "or pick a price book in Old" (gone: the Old view retired in v2.2707, and the sentence
  was never updated). The one door Old had — pick a book, price this version from it — has no
  replacement, so an unpriced version is a dead end unless she copies prices she doesn't want.
  The fix is to make the "No prices yet" panel a real start: a Price from the book button (the
  handler still exists and is already version-aware), the drawer for another book, and the copy
  door kept honest beside it. The Workbench then opens on the version's own counts with Fill
  from book and the solver — Old's flow, inline.
next: >
  The three PRs merge, then the live walk per How to verify (ZZ bid: + version unchecked, the
  book door, the copy door, the labor line, the modal words); delete the ZZ rows after.
size: M (PR 1 the start panel) + S (PR 2 the labor line) + S (PR 3 the + version modal tells the truth)
blocker: none — built on the owner's go 2026-10-20 (calls 1–4 all took the recommended defaults).
---

# Pricing: price a fresh version from the book, right in the Workbench

Mock-up: [`mockup.html`](./mockup.html) — four states: today's dead end, the new start panel, the
Workbench one press later, and the two honesty fixes (PR 2's labor line, PR 3's modal words). All
data made up (Caprock Builders / Cedar Ridge Fire Station / book HALEY).

## The ask

Wendi (estimator), 2026-10-20, from the Pricing tab of a two-version bid: "I want to be able to
price a different version in the newer view without going to Old… I do not want to copy the
base price as this is a side by side rebid with different counts."

## What exists today — and the exact gap

- A side-by-side rebid is exactly what versions are for: **+ version** in the GC's group clones
  the counts and takeoff, and the "Copy all the source's prices" box can be left unchecked
  (`BidVersionPicker.tsx:634-637`) — right for a rebid whose counts are re-done. The letter even
  prints two base versions as Option 1 / Option 2 (v2.4723). Each version owns its counts
  (v2.2132) and its prices (`price_book_versions.bid_version_id`).
- An unpriced version makes `deriveActivePricingId` return null — **deliberately** no template
  fallback (`src/lib/bids/pickActiveVersion.ts:24-28`) — so the Workbench doesn't render and the
  empty panel shows instead (`BidsPricingTab.tsx:2624-2648`): *"No prices yet for {GC}. Start
  from another GC's base price: [Copy {GC}'s base price] or pick a price book in Old and price
  from there."*
- **"Old" is gone.** The classic grid with its `Price book:` select retired in v2.2707. The
  sentence is from v2.2154 and was never updated. So the panel's only live offer is the copy —
  the one thing a different-counts rebid must not do. Every other price-creating door needs an
  existing price: the book chip and Fill-from-book render only inside the Workbench
  (`BidsPricingTab.tsx:3450-3484`), the ＋ Add price modal disables Create when the version has
  no prices (4280, 4298), and the "blank or cloned" branches of `savePricingVersion` are dead
  code (1225-1236, nothing opens that form any more).
- Two side gaps ride along. With two versions of the **same** GC, the panel reads the GC's name
  twice ("No prices yet for DSWCON… Copy DSWCON's base price") — `gcNameForVersion` never says
  the version's name. And with no donor at all the panel says "The Workbench needs Counts, an
  active Pricing, and a cost estimate" even when counts and cost are fine and only a price is
  missing.
- The help guides still describe the retired surface: `price-a-bid-with-the-workbench.md` opens
  on the Old/New pills, and `bid-one-project-to-multiple-gcs.md` repeats the copy-only offer.

## Three lenses

- **Wendi's seat**: she is standing on the new version's chip, counts done, book in her head.
  Today the app offers her the wrong thing and a door that no longer exists — the comment trail
  shows this is her daily surface (`BidsPricingTab.tsx:1655`, v2.2396 names her). It should be
  one press: her book, the Workbench, this version's own counts.
- **The job behind the ask**: a GC asks for the same project priced two ways — to plans and to
  an addendum, each with its own counts. Pricing a fresh count list from the book is the core
  estimating act, and the app does it for the first version of every bid; the second version
  lost its door when Old retired and nobody noticed until rebids made unpriced versions common.
- **The whole office**: the fix helps every unpriced version, not just rebids — a GC packet
  made without the copy box lands in the same dead end. Downstream everything already works:
  the book start stars the new price (`attachAndActivateNewBidPricing` →
  `saveBidSelectedPriceBookVersion`), so the strip's "gets N prices", the letter's Option 1 / 2,
  Share/Print/CSV all light up. One honest-numbers hazard surfaces with rebids: labor rows are
  bid-wide and re-synced to the **active** version's counts only when Labor or Takeoffs loads
  (`Bids.tsx:1006-1007`, `syncCostEstimateLaborRows`), so the margin on one version can read
  against the other version's labor counts until she visits Labor — PR 2 says so on the strip.

## The design (PR 1)

The `!derived` empty state becomes a **start panel** (one new pure kernel decides its choices):

- Title names the version when the bid has siblings of the same GC: **"No prices yet on
  Addendum 2 rebid."** — not the GC twice.
- **Price from the book** — the primary button, naming the default book: the sibling version's
  book when it has one (lineage root via `resolvePriceBookTemplateRoot`, so a rebid prices from
  the same book as the original), else the user's default (`pickDefaultTemplatePricingId`).
  Pressing it calls `onSelectPriceBookTemplate(templateId)` (`BidsPricingTab.tsx:1649-1675`) —
  the Old select's handler, still alive and already version-aware: it clones the template into
  the bid, stamps `bid_version_id` to this version, stars it, and the Workbench renders on this
  version's own counts. A sub-line is honest about freshness: *a fresh copy at today's book
  prices*.
- **another book ▸** opens the price book drawer (mounted outside the derived block,
  `BidsPricingTab.tsx:4142-4180`), where **Use {book} on this bid** completes the same way —
  one book-picking surface, the drawer, as everywhere else in the Workbench.
- **The copy door stays** (call 1), moved under the book offer and kept honest: *"Copy prices
  from To Plans — ★ base. Copies follow fixture names. Rows only in this version stay
  unpriced."* (the v2.2405 re-key rule, said out loud). Cross-GC donors keep today's wording.
- The donor-less branch stops lying: when counts and cost exist and only a price is missing, it
  shows the same panel (book door, no copy row); the "needs Counts / Labor" text stays only for
  bids that truly lack them.
- The "in Old" sentence is deleted; both stale guide passages are rewritten with the new flow
  (the Workbench guide's opening also drops the retired Old/New pills).
- After the book lands, exact-name matches **wait on the counting button** (call 3): she lands
  on the Workbench with *Fill 34 matching from book* ready — one visible press, no silent
  writes. The solver, brush, and per-row assign searches are all already there.

**Rejected on purpose**:

- *A template fallback in `deriveActivePricingId`* — the no-fallback null is deliberate
  (BP483's shared-book accident; `pickActiveVersion.ts:24-28`); the fix creates a bid-owned
  copy on an explicit press instead.
- *Resurrecting the dead `'pricing-blank'` branch as a "start blank" door* — a blank price with
  no book behind it leaves every assign search empty; the book-first flow is the one Old had
  and the one the Workbench is built around.
- *Auto-copying the sibling's prices onto the rebid* — exactly what Wendi said no to.

## Where it plugs in

| Piece | Exists | New |
| --- | --- | --- |
| `onSelectPriceBookTemplate` → `cloneTemplateIntoBidAndActivate` → RPC `clone_price_book_version_to_bid` → `attachAndActivateNewBidPricing` (stamps version, stars) | yes (`BidsPricingTab.tsx:1585-1675`) | called from the panel |
| `src/lib/bids/pricingStartChoices.ts` | — | new pure kernel: panel model (title names version vs GC, default book id, other-books count, donors with labels, which branch) + tests |
| Empty state (`BidsPricingTab.tsx:2624-2648`) | copy-only, stale sentence | the start panel |
| Price book drawer + `onUseOnBid` | yes (`BidsPriceBookDrawer`, wired at 4155) | opened from the panel's **another book ▸** |
| `matchCountRowsToBookEntries` / Fill button, solver, brush | yes | — (they appear once the Workbench renders) |
| History | book switches tagged `BID_ACTIONS.bookSwitch` (#73) | the panel's press carries the same tag |
| Help guides | `price-a-bid-with-the-workbench`, `bid-one-project-to-multiple-gcs` | both rewritten where they describe Old / the copy-only offer |
| Render smoke | none covers the empty state today | one for the panel's three shapes |
| Migrations | — | none in any PR |

Out of scope, noted so nobody re-derives: per-version labor (labor rows and `cost_estimates`
are bid-wide by design — `BIDS_SYSTEM.md`'s "Labor, cost estimates, and POs stay shared
bid-wide"); PR 2 only tells the truth about it. The robot/twin pricing fence is untouched
(`is_robot` copies are left alone).

## The plan

- **PR 1 (M)** — the start panel: kernel + tests, panel UI, drawer door, honest copy captions,
  version-aware names, stale-sentence deletions, both guide passages, render smoke. No
  migration.
- **PR 2 (S, gated on call 4)** — the honest labor line: a kernel compares the active version's
  counts to the bid-wide labor rows' counts by fixture name; when they disagree the strip gains
  one amber line — *"Labor hours follow To Plans' counts. Open Labor to refresh them for this
  version."* — whose door is the Labor tab. No write, no sync from Pricing.
- **PR 3 (S)** — the + version modal tells the truth: with "Copy all the source's prices"
  unchecked, the static "copies its counts, takeoff and prices" sub-line
  (`BidVersionPicker.tsx:614`) follows the checkbox and says *"copies its counts and takeoff —
  starts unpriced; the Pricing tab will offer your books."*

## Calls that are the owner's (defaults proposed)

1. **The copy door** — stays beside the book door with the counts-differ caption (recommended:
   copying is right when the rebid shares most fixtures, and the caption says exactly what it
   does) vs hidden whenever the two versions' counts differ.
2. **Default book** — the sibling version's book when it has one (recommended: a rebid prices
   from the same book as the original, apples to apples) vs always the user's default book.
3. **Fill on arrival** — exact-name matches wait on the counting Fill button (recommended: one
   visible press, no silent writes) vs assigning themselves as the Workbench opens.
4. **The labor line** — PR 2 ships in this train (recommended: rebids make the stale-labor trap
   live, and it is small) vs waiting for a real misread.

## How to verify

- ZZ Test bid, one GC: + version with the copy box **unchecked**, change two counts on the new
  version. Pricing shows the start panel naming the version; Price from the book opens the
  Workbench on the new version's counts; Fill matching counts only its rows; the strip flips to
  "2 versions · gets 2 prices"; the letter offers Option 1 / Option 2.
- Same bid: the copy door still works and re-keys by fixture name; a row only on the new
  version stays unpriced and the caption said it would.
- A second GC packet made without prices: the panel offers the book and the cross-GC copy; the
  drawer's Use-on-this-bid completes from **another book ▸**.
- Unsplit bid with no prices and no counts: the "needs Counts / Labor" branch still shows.
- PR 2: with the two versions' counts differing, Pricing shows the amber line on the stale one;
  opening Labor clears it.
- Live walk per the usual recipe (memory: live-test-recipe-prod); delete the ZZ rows after.

## Where it stands

Proposed 2026-10-20 from Wendi's report (her screenshot of a two-version bid's dead end);
research done in code, mock-up rendered and checked. The owner said go the same day and took
all four defaults. Built as PR 1 v2.5687 (the start panel), PR 2 v2.5689 (the labor line) and
PR 3 v2.5690 (the modal truth), stacked. Left: the merges and the live walk above.
