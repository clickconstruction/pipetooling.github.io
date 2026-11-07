---
name: "Development page: two reads the Gun Dog spike left for later"
number: 280
group: residual
status: opened 2026-11-07 at #208's close, from the two lines the Gun Dog spike of 2026-11-02 left under *Left for later*; nothing built
summary: >
  The Gun Dog spike (punch list #208, 2026-11-02) cut the Development page's read from seven
  round trips to four and left two reads as they were. The pay-speed read for the Money look's
  expected day calls `get_billed_customer_pay_speeds`, which returns every billed customer's pace
  when the page wants one payer's; a by-customer RPC is a migration. The History look's entries
  read takes every column of `development_history_entries` for the site, up to 500 rows, and on
  the real site that is about 279 KB of kept mail bodies the page shows folded. Neither is wrong,
  both are weight the page carries on every open.
next: Decide whether the page's open is slow enough to earn either. If yes, PR 1 the entries read slimmed (the list's columns, a body fetched on unfold, no migration), then PR 2 the by-customer pay-speed RPC with its migration. Then delete this file.
size: S (PR 1 the entries read) + S (PR 2 the pay-speed RPC, a migration)
blocker: None. A measured open of the real site's page, before and after, is the proof either PR needs.
mockup: not required — reads only, no screen changes
opinion: later — the page opens in about four seconds on the real site after the spike's cut; neither read has been named as slow since
---

# Development page: two reads the Gun Dog spike left for later (#280)

## Where this came from

The Gun Dog design spike with the owner on 2026-11-02 (its notes lived in `to-dos/developments/SPIKE_GUNDOG.md` until #208 retired on 2026-11-07; the deleting commit holds them) flattened the page's read: the row and the members go out together, the pay-speed RPC leaves at once, the prior numbers ride in the fan-out, and only the names wait on everything (v2.6377, `fetchDevelopmentPage.ts`). It measured the Jobs & bids table at about 4.1 seconds from about 5.5 on the dev server with StrictMode's double effects, and wrote two reads down as *left for later, not in the stack*. This card is their one home.

## The two reads

1. **Pay speed by one customer.** The Money look's expected day reads the payer's pace the way the Pipeline's billed rows do, through `get_billed_customer_pay_speeds()` (migration `20260821100000`), which computes every billed customer's speed and hands the whole list back; the page keeps one. A `get_customer_pay_speed(p_customer_id)` that reads one payer is the fix, and an RPC is a migration (`SET lock_timeout = '3s'` first, no table, no fences). The Pipeline keeps the whole-list read; nothing else changes.
2. **A slimmer history-entries read.** `fetchDevelopmentPage.ts` reads `development_history_entries` with `select('*')` for the site, newest first, up to 500 rows. The 188 mail lines the inbox robot kept on the real site in October carry their first message whole, and the page folds them under *more ›* — so most of what comes down on every open is text nobody reads until they unfold a line. The fix is the list's own columns on the first read and the body fetched when a line unfolds, or a view that trims the body to its first lines with a flag that there is more. No migration for the first shape; the view is one if that shape is chosen.

## Where it plugs in

- `src/lib/developments/fetchDevelopmentPage.ts`: `paySpeedP` (the RPC call) and the `development_history_entries` read in the fan-out.
- `src/lib/developments/siteMoney.ts`: takes `paySpeed` as `PaySpeedData | null`; a by-customer shape would replace the list with one row.
- `src/lib/developments/history.ts` and `historyFolds.ts`: the lines' shape, which decides which columns the first read needs.
