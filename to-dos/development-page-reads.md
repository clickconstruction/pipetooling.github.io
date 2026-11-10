---
name: "Development page: two reads the Gun Dog spike left for later"
number: 280
group: residual
status: built and measured 2026-11-08 — PR 1 the heads view (v2.6735, #7357) and PR 2 the payers' pace (v2.6739, #7363) on main, both migrations on prod, the after under the before below; the types PR #7395 on main; nothing left to build
summary: >
  The Gun Dog spike (punch list #208, 2026-11-02) cut the Development page's read from seven
  round trips to four and left two reads as they were. The pay-speed read for the Money look's
  expected day calls `get_billed_customer_pay_speeds`, which returns every billed customer's pace
  when the page wants one payer's; a by-customer RPC is a migration. The History look's entries
  read takes every column of `development_history_entries` for the site, up to 500 rows, and on
  the real site that is about 279 KB of kept mail bodies the page shows folded. Neither is wrong,
  both are weight the page carries on every open.
next: Nothing to build. The types PR #7395 is on main: delete this file and write its Closed line in `to-dos/README.md` (the owner's call, as with #257).
size: S (PR 1 the entries read) + S (PR 2 the pay-speed RPC, a migration)
blocker: None. A measured open of the real site's page, before and after, is the proof either PR needs.
mockup: not required — reads only, no screen changes
opinion: later — the page opens in about four seconds on the real site after the spike's cut; neither read has been named as slow since
ver: v2.6735 (PR 1, the heads view and the body read on *more ›* and for a search) · v2.6739 (PR 2, `get_customer_pay_speeds(uuid[])` and the Money look's read of the site's payers alone)
---

# Development page: two reads the Gun Dog spike left for later (#280)

## Where this came from

The Gun Dog design spike with the owner on 2026-11-02 (its notes lived in `to-dos/developments/SPIKE_GUNDOG.md` until #208 retired on 2026-11-07; the deleting commit holds them) flattened the page's read: the row and the members go out together, the pay-speed RPC leaves at once, the prior numbers ride in the fan-out, and only the names wait on everything (v2.6377, `fetchDevelopmentPage.ts`). It measured the Jobs & bids table at about 4.1 seconds from about 5.5 on the dev server with StrictMode's double effects, and wrote two reads down as *left for later, not in the stack*. This card is their one home.

## The two reads

1. **Pay speed by one customer.** The Money look's expected day reads the payer's pace the way the Pipeline's billed rows do, through `get_billed_customer_pay_speeds()` (migration `20260821100000`), which computes every billed customer's speed and hands the whole list back; the page keeps one. A `get_customer_pay_speed(p_customer_id)` that reads one payer is the fix, and an RPC is a migration (`SET lock_timeout = '3s'` first, no table, no fences). The Pipeline keeps the whole-list read; nothing else changes.
2. **A slimmer history-entries read.** `fetchDevelopmentPage.ts` reads `development_history_entries` with `select('*')` for the site, newest first, up to 500 rows. The 188 mail lines the inbox robot kept on the real site in October carry their first message whole, and the page folds them under *more ›* — so most of what comes down on every open is text nobody reads until they unfold a line. The fix is the list's own columns on the first read and the body fetched when a line unfolds, or a view that trims the body to its first lines with a flag that there is more. No migration for the first shape; the view is one if that shape is chosen.

## What the open costs (measured 2026-11-08)

The dev server as the dev, the Gun Dog development, three client-side opens in a row (Settings → the page), a wrapper on the page's own `fetch` recording every Supabase call's time and bytes. StrictMode runs every effect twice on the dev server, so each read appears twice an open; prod runs each once.

| Open | Supabase calls | Bytes | First lines drawn | Last call ended |
| --- | --- | --- | --- | --- |
| 1 | 76 | 1,694,849 | 3.3 s | 5.2 s |
| 2 | 90 | 1,930,607 | 1.6 s | 3.7 s |
| 3 | 105 | 1,945,680 | 1.5 s | 3.2 s |

The two reads this card holds:

- **`development_history_entries`**: 299,111 bytes, 281 to 515 ms, twice an open — the second biggest call on the page, about 31% of its bytes, and co-slowest in the fan-out with the job notes (518 ms), so cutting it alone moves the wall clock little. 218 rows: 200,917 characters of body and 89,872 bytes of every other column; 132 of the 218 lines are longer than the 260-character fold, the longest 7,096 characters, the median 365. The heads at 300 characters are 54,068 characters, so a view that cuts the body at 400 brings the read to about half.
- **`get_billed_customer_pay_speeds`**: 87,600 bytes, 194 to 378 ms, twice an open — about 9% of the page's bytes. It leaves at once and ends before the members read does (`jobs_ledger`, 522 to 634 ms), so it is off the critical path: a by-customer RPC saves the bytes and the server's work, not a millisecond of the open.
- For scale, the biggest call is `mercury_transaction_job_allocations` at 391,551 bytes and 653 to 716 ms, the Costs column's read, #257's territory and not this card's.

**Decision.** The entries read earns PR 1: a third of the page's bytes on every open, two thirds of them words the page folds and almost no open unfolds. The card's first shape, the list's columns with the body fetched on unfold, needs no migration but leaves the lines with no words at all, since the body is the words; PostgREST cannot cut a column without a view, so PR 1 is the card's second shape, `development_history_heads` (`left(body, 400)` and `char_length(body)`), with the whole body read by id on *more ›* and once for the site when a search is typed, so a search still reads every word. The after figures go under this table once the view is on prod. The pay-speed read is the smaller share and off the clock; PR 2 follows PR 1 as the card planned: `get_customer_pay_speeds(p_customer_ids uuid[])` runs the whole-list read on the server and hands back its shape cut to the site's payers (each job's GC, else its customer), the company and segment medians kept whole for the borrowed pace, so the server's work is the same and the bytes are what it saves; the read now rides beside the fan-out once the members name the payers.

## What the open costs after (measured 2026-11-08, both migrations on prod)

The same site, the same script, the same dev server with StrictMode's doubling, three client-side opens, the dev server serving `main` with both PRs.

| Open | Supabase calls | Bytes | First lines drawn | Last call ended |
| --- | --- | --- | --- | --- |
| 1 | 76 | 1,267,242 | 1.7 s | 3.5 s |
| 2 | 75 | 1,251,511 | 1.5 s | 3.5 s |
| 3 | 75 | 1,251,511 | 1.5 s | 3.6 s |

- **`development_history_heads`** (PR 1): 164,364 bytes, 263 to 419 ms, twice an open — from 299,111. The list draws the same lines; a kept line's *more ›* showed *Reading the rest…* and then the whole line after one 1,660-byte read by id; typing in the search read every body once (219,240 bytes) and the meta read *40 of 494 lines match*; a job note's *more ›* read nothing.
- **`get_customer_pay_speeds`** (PR 2): 391 bytes, 140 to 225 ms, twice an open — from 87,600. The cut answers the Money look the same as the whole list did: for the site's one payer (24 jobs, one GC) its `customers`, `customerTypes` and `receipts` entries and the `company`, `segments` and `quality` blocks compare equal to the whole list's; the payer has no median of its own, so the expected day borrows the segment or company pace from the blocks that came down whole.
- **The page an open**: 1.25 to 1.27 MB from 1.93 to 1.95 MB, about 35% less; 75 to 76 calls from 90 to 105 (the call counts before included a longer tail the waiting script caught). First lines drawn 1.5 to 1.7 s from 1.5 to 3.3 s and the last call 3.5 to 3.6 s from 3.2 to 5.2 s: the wall clock moved little, as the before predicted, since the fan-out's slowest call is still the job notes at 465 to 632 ms and the Costs column's `mercury_transaction_job_allocations` at 555 to 688 ms. The bytes are the saving, and on a phone's signal that is the second or so the page no longer spends downloading folded mail.

Before each push the fallbacks were read live: the view and the function answered 404 and the table and the whole list answered right after, the page drawing either way.

## Where it plugs in

- `src/lib/developments/fetchDevelopmentPage.ts`: `paySpeedP` (the RPC call) and the `development_history_entries` read in the fan-out.
- `src/lib/developments/siteMoney.ts`: takes `paySpeed` as `PaySpeedData | null`; a by-customer shape would replace the list with one row.
- `src/lib/developments/history.ts` and `historyFolds.ts`: the lines' shape, which decides which columns the first read needs.
