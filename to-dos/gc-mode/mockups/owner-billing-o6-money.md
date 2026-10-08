---
name: "GC mode, Owner Billing O6a: the Money tab, read only"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (PR 8, O6)
status: planned 2026-10-08 by Helper 5 at the lead's ask · O6's read-only half, so the money roles have a screen to test before our bill exists · nothing built
---

# O6a: the Money tab, read only

The plan's O6 has a read half and a write half:
- **Read:** the Money tab, which this mockup covers.
- **Write:** **Bill the interest**, the interest rate per job, and **Finish date** with the late fee. These are O6b, after O4a.

O6a reads only what O1, O3, O5a and the kernels already give, plus O4a's record once it lands. It writes nothing, so it has no migration and no function. Its only gate is the audience.

## Who sees it

The owner and the controller, the plan's decision 2. The Board's B5-a named that audience once: `gc_money_team()` in the database, and `GC_MONEY_TEAM` / `canSeeGcMoney` in `src/lib/gc/access.ts` (dev, the leaders, the controller). O6a shows **Money** to `canSeeGcMoney(role)`.

Today Owner Billing's tables are dev only (O1's policies), so a leader or the controller would read empty rows. **While it is built, Money shows for a dev only**, beside the Board's lenses. The Owner Billing door, the plan's own door PR, swaps the policies to `gc_money_team()` and lets the gate read `canSeeGcMoney`. It is one line in the page.

## Where it sits

A fifth lens on the dev switch on `/gc`: **Project Board · Trade partners · Follow up · Trade portals · Money**.
- `devView === 'money'`, as `GcProjects.tsx` holds the others.
- The prototype placed it as a board tab, the Board lane's to place, and this is that place. Helper 2 owns the switch, so the one line there is agreed with them.
- **Bill the customer** on any row opens O4a's window at `?bill=<project>`. Until O4a, the row reads without the button.

## What it reads

One read for every job that is ours, `buyout` or `building`, as `allJobsMoney` counts them:

| Rows | From | On main |
|---|---|---|
| The board's projects and customers | `loadGcBoardRows` → `boardStateFromRows` | yes |
| Change orders | O3-ui's `loadGcChangeOrders`, `withChangeOrders` | yes (#4963) |
| Our bills as they went | O5a's `loadGcOwnerBillingRows` | yes (#4966) |
| The price as signed, the retainage, the days to pay | `gc_owner_contract_lines`, O1's `gc_projects` columns | the tables yes; the read is O4a-3's `loadGcOwnerTerms`, here for many projects |

`billingStateForAll(state, rows)` is O4a-3's `billingStateFor` for every project at once, in `billCustomer.ts`, with the same test. It lays each job's signed price, retainage, step and record over the board's project. Both windows then read one state builder. If O6a is cut before O4a-3, it brings `billCustomer.ts` with it and O4a-3 takes it from main.

## The sections, and what each reads today

Each section is the prototype's own, read by the kernels already on main (O2a, O2b). Each says in plain words when it has nothing yet, and never shows a made-up number.

| Section | Kernel | Reads real data | Waits on |
|---|---|---|---|
| **Across our N jobs:** paid in, paid out, where we stand | `allJobsMoney().totals` | The jobs and what we billed (O5a) | Paid in: O5c (the payments on the billing job). Paid out: Building's U6 (the trades' draws). Until both, it reads "Nothing paid in or out yet" over the billed and held totals. |
| **Who owes us:** late first, then waiting on the architect | `allJobsMoney().owed`, `ownerPayDue`, `ownerLateBills` | Every sent pay application with money open (O5a) | O4a for any bill to exist. "Late" counts from the certificate plus `owner_pay_days` (decision 7), so a job with no days typed is never late. |
| **Each job:** its price, billed, held, owed, waiting on the architect, **Bill the customer** | `allJobsMoney().jobs`, `ownerAccount`, `ownerContractPrice` | The signed price and signed change orders (O1, O3), and the record (O5a) | The trades' side of each job waits on U6. |
| **Bill day across our jobs:** which job bills on the 25th, and about how much | `billDay` | The drafts from `ownerPayApp` | Until U6, a draft carries signed change orders at their percent, as the plan's O4a check has it. The section says the trades' lines join once they report. |
| **What each job makes us** | `allJobsMargin`, `jobMargin` | The signed price, and the Board's carried quotes once B5-b/c map them | Our own crew at its Pipeline cost (U8). Until then, our crew reads at its budget, as `jobMargin` already marks it. |
| **What we bill, month by month** | `billingByMonth`, `billingForecast` | Nothing yet | The schedule lane's activities mapper (no schedule read on main yet) and U6's SOV lines. Hidden until then, with one line saying why. |
| **The next six weeks** | `cashAhead` | Our bills: their expected days from the pay days typed | The trades' draws (U6). Shown as "the customer's side only" until then, which is the plan's "owner side only until U6". |
| **Interest on late bills** | `ownerInterest` | (none) | **O4a**, for certificates and due days, then O6b for the rate and **Bill the interest**. Marked "comes with our bill". |
| **The late finish** | `lateFinish` | (none) | **O4a**, for the contract with its days, then O6b's **Finish date** and late fee. Marked "comes with our bill". |

The last two show one line each and no numbers: *Interest on late bills comes once we bill the customer from the app.*

## The screen

`src/components/gc/GcMoney.tsx` ports the prototype's five pieces (branch `spike/gc-mode`):
- `GcOwnerBillingMoney`: the headline, who owes us and each job;
- `GcOwnerBillingBillDay`;
- `GcOwnerBillingMargin`;
- `GcBillingForecastMoney`;
- `GcOwnerBillingAhead`.

They are read only, so the prototype's dispatch props go. Each is its own section with a heading, in the order above. On a phone each job is a card, as the Board's rows are, and nothing scrolls sideways at 375 px. Numbers use `money` from `words.ts`.

## Its checks

- **`billCustomer.test.ts`** gains `billingStateForAll` beside `billingStateFor`: two jobs, each with its own retainage, signed price and record, and the other projects left as the board's.
- **The kernels** are pinned already, `ownerBilling.test.ts` and `ownerBillingRest.direct.test.ts`, so the screen adds no math.
- **`GcMoney.render.test.tsx`** on the test state:
  - the headline's words;
  - who owes us, late first;
  - each job's row and its **Bill the customer**;
  - each waiting section saying why, with no number.
- **Live, read only,** on the test project as the dev: Money opens, lists the job with its signed price, and says what waits.
  - Before O4a, signing the test project's contract at test numbers is the one write, made only on the lead's OK.
  - After O4a, the walk adds one sent pay application and its certificate.

## Docs

- The guide `see-the-money-on-our-gc-jobs.md` (dev). Its title is the plan's, and its first paragraph is plain prose for the share card.
- `PROJECT_DOCUMENTATION.md`: the `/gc` paragraph names the Money lens.
- `GLOSSARY.md`: nothing new. Billing job and change order are there.
- The release note and fragment.

## The PR

**O6a**, one PR, cut from `origin/main` after O3-ui (#4963) merges. O5a is already in. It is cut before or after O4a-3: whichever lands first brings `billCustomer.ts`.

## The calls this adds

1. **Show a section that has nothing real yet, or hide it?** I recommend one line in its place, with no numbers, as above. The money roles then see what is coming and when. Hiding the section would make the tab look finished.
2. **Who sees Money before the door:** dev only, as the tables are. The door PR opens Money and the tables together to the money team.

## Is this the best we can do?

It puts the money roles on the prototype's own screen over real data, one section at a time as each input lands, and never shows a number it cannot back. It could be better two ways:

1. **The billing jobs' own AR.** Each GC job's bills live on its billing job, so the Pipeline's AR, pay speeds and chase list already count them once O4a makes them. Money could link each job to its billing job's Pipeline card. That is one line once O4a's billing job exists, and worth it in O6b.
2. **One money read for both modes.** The owner sees AR on the Pipeline's dashboard and GC money here. A later "all money" view would read both. That is out of this lane, and noted for the owner's list.
