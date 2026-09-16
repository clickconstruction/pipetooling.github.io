---
name: "Bill tab Invoices list: test it live"
group: close
status: "not started · **unblocked**: the Pages deploy landed 2026-09-16 · quick"
summary: >
  **Test the v2.3478 Invoices list on clicktooling.com**: J258's three rows and sum line, a
  promised job, a draft, the 375 px sheet, dark theme — verified on the local preview only.
next: >
  J258's three rows + sum line = tiles, a promised job, a draft, the 375 px sheet, dark theme.
  Anything off is a fresh-branch fix. Then delete the file.
size: S (an hour, read-only)
blocker: None — needs a signed-in prod session.
ver: v2.3478 live
---

# Bill tab Invoices list (v2.3478) — test it live

## The ask, in the owner's words

"Add a to do to test it live" (2026-09-15), after PR #3227 merged and the deploy kept getting superseded.

## What shipped

Job window → Bill → **② Invoices** is a row list now — every bill (drafts, open, **paid**), three lines each (chip · amount · actions / *sent … to …* / *$… open · … past expected · They said …*), the action that fits the state, a per-row ⋯ for the rare ones, a sum line that uses the tiles' math, and a container-query phone layout. Mock-up: <https://claude.ai/artifact/A8LFiqPAd6jmpbvLSeEdbx>. Record: `docs/recent-features/v2.3478.md`. Verified on the local preview only (560 px by eye, 375 px by computed style) — never on clicktooling.com.

## How to verify (read-only — real customer data)

Confirm the bundle first: `curl -s https://clicktooling.com/ | grep -o 'assets/index-[^"]*\.js'`, then grep that file for `jobInvoiceLedger` — absent means the deploy hasn't landed.

1. **J258 · Dudley Mason** (Jobs → Pipeline → Billed Awaiting Payment → Edit → Bill), the job the design was drawn from:
   - three rows in this order: {{chip:blue|Billed}} $9,800 · {{chip:green|Paid}} $8,900 · {{chip:green|Paid}} $8,000
   - line 2 / 3 on the open row: *sent Sep 4 to RMC- Dudley Mason* / **$9,800 open** · *21 d past expected* (red — the number moves a day a day)
   - the $8,900 row reads **$8,900 marked paid · no payment on record** (a March stub — 4 such rows exist in prod, $37k; a cleanup candidate, not a bug in the list)
   - the $8,000 row reads *sent May 13 to RMC- Dudley Mason* / **$8,000 paid** · *Jun 4 · 22 days*
   - sum line: **paid $8,000 · open $9,800 · = billed $17,800** — matches the tiles above (45 % Paid $8,000 · 55 % Billed $9,800)
   - **Text · Copy link · Email** on the open row with Email dimmed (no customer email on the job); **View** opens the bill; ⋯ lists Add discount · See in Pipeline · Show memo & footer · *Who else sees this bill* (Rizvi's statement / Only the payer) · Send back (red, last). Don't click Send back.
2. **A job with a promise** (Pipeline card wearing *✓ Promised …* — e.g. Reliant Health 813): the open row's line 3 ends *They said Sep 15* (green) instead of the past-expected detail.
3. **A Ready to Bill job with a draft**: {{chip:yellow|Draft}} row reads *not sent · bills {customer} · auto remainder* / **$X to bill**, with {{button:blue|Send bill…}} and {{button:gray|Bill to ▾}}; ⋯ has no Delete draft on the auto remainder, has it on any other draft.
4. **Phone** (Chrome DevTools → 375 × 812, reload): the Job window is a full-bleed sheet; the list is 346 px wide and nothing scrolls sideways; the chase cluster sits under the words as one row of 44 px buttons; View and ⋯ are 44 px; the sum line is left-aligned; tiles are 2 × 2.
5. **Dark theme** (gear menu): chips, the red *past expected*, the green *They said*, the dimmed Email all legible.

Anything off → note it here with the job number and a screenshot, then fix from a fresh branch (`invoiceLedgerRow.ts` for words, `JobFormInvoiceList.tsx` for actions, `.jobInvoiceLedger` in `index.css` for layout).
