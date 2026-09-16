# Make Payment, rebuilt — one payment, the invoices it covers, the total you're about to write

Status: not started · owner approved 2026-09-15 ("I love this") · two client-only PRs, the first a bug fix · someone other than the proposing session builds it

## The ask, in the owner's words

After the Add / Edit Invoice form was rebuilt (v2.3473 the scroll fix, v2.3476 the seven-change pass): "if we did the same for the Make Payment modal could you show me a before and after?" Then: "I love this, please save this to the app's docs to-dos. I'm going to let someone else build it."

## The decision

The modal is rebuilt around how Taunya pays a house — one cheque or ACH on the house's payment day, covering a batch of invoices off the statement — and the bug found while reading it ships first on its own.

1. **The link stops erasing the PDF (bug, PR 1).** `applyPayment` writes `{ is_paid: true, link: applyPaymentLink.trim() || null }` to every selected invoice — a blank field sets `link = null` and **wipes the invoice's Drive PDF link**. Fix: write `link` only when the field is non-empty, and only to invoices whose `link` is null (never in place of a PDF). Rename the field *Receipt or remittance link* with the hint "Kept alongside each invoice's PDF — never in place of it."
2. **The payment first, with the day it cleared.** A *Paid on* date (default today; hint "Reece's payment day is the 10th." from `dueDateHint`) written to every invoice in the batch through `paidAtPayload` (`src/lib/materials/supplyHouseInvoiceForm.ts`, v2.3476) — one date for the cheque instead of seven click-time stamps. Blank still lets the trigger `sync_supply_house_invoice_paid_at` stamp `now()`.
3. **A table, not a checkbox list.** Columns: select · Invoice (number, Job acct pill, PO · invoice date) · Due (an *N days over* pill — amber, red past 60; *due M/D* when not yet) · Job (first allocation's J# · name, city) · Amount. Sorted oldest due first (statement order).
4. **Filter chips replace "Show all invoices":** *Unpaid · N* (default) · *Past due · N* · *On job account · N* · *Paid too*.
5. **Select all, select the late ones.** A header checkbox (tri-state) ticks everything showing; *Past due* narrows first, so "pay everything overdue" is two clicks.
6. **The total is the button.** A pinned footer: "2 invoices · **$8,625.44** · leaves $49,523.52 unpaid"; the green button reads *Record $8,625.44 paid*. Title bar: *Record a payment to Reece* · "$58,148.96 unpaid across 7 invoices · 2 past 60 days".
7. **Panel scrolls, header and footer stick** — the v2.990 sticky-modal pattern (`stickyModalPanelStyle(620)`, `stickyModalHeaderStyle`, the v2.3476 footer), `useBodyScrollLock`, safe-area overlay padding. Today's panel has the same un-capped shape that clipped the invoice form.
8. **After Apply:** toast "2 invoices marked paid 9/15 · $8,625.44 to Reece"; the house's table refreshes with the same Paid On dates.

Decisions taken by default (the owner said yes to the page as drawn): no new payment table or amount field (the app records which invoices are paid and when, not the cheque — Banking has the Mercury transaction); green stays the Apply colour (it is the page's *Make Payment* button); partial payments stay unmodeled (an invoice is paid or not; nobody has asked).

Rejected: keeping "Apply Payment" as the title (the page button says *Make Payment*; the proposal says *Record a payment to {house}* so the two agree on what happens).

## The mock-up

[`mockup.html`](./mockup.html) — before / after with six callouts (also published as the artifact *Supply House Make Payment*, https://claude.ai/artifact/1JsJTuNBZXb7H8KDccbh6w). Rows are illustrative; Reece's real unpaid balance ($58,148.96 across the four aging buckets on 2026-09-15) is the figure they sum to.

## Where it plugs in

| Exists | New |
|---|---|
| `SupplyHousesTab.tsx` — `applyPaymentFormOpen` / `applyPaymentLink` / `applyPaymentSelectedIds` / `applyPaymentShowAll` state, `openApplyPaymentForm`, `applyPayment` (the `update({ is_paid, link }).in(ids)`), the modal at the bottom of the file | the rebuilt modal; `applyPaymentPaidOn` state; a `filter` state replacing `applyPaymentShowAll` |
| `supplyHouseInvoices` (already `select('*')` + `job_allocations`) — carries `due_date`, `paid_at`, `on_job_account`, `link`, allocations | nothing to fetch |
| `invoiceJobDetailsMap` / `get_jobs_ledger_by_ids` — job number, name, address for a job id | reuse for the Job column (batch the first allocation of every showing invoice) |
| `src/lib/materials/supplyHouseInvoiceForm.ts` — `paidAtPayload`, `paidAtIsoFromYmd`, `dueDateHint` (v2.3476) | `src/lib/materials/supplyHousePayment.ts`: `daysOverdue(dueYmd, todayYmd)` → pill tone/text · `filterInvoices(list, filter, todayYmd)` · `selectionSummary(list, selectedIds)` → count, sum, remaining · `paymentPayload(paidOnYmd, link)` → `{ is_paid: true, ...paid_at }` plus the per-invoice link rule · `paymentToast(count, sum, dateYmd, house)` — kernel tests for every one |
| `stickyModalPanelStyle` / `stickyModalHeaderStyle` / `STICKY_MODAL_CLOSE_BUTTON_STYLE`, `useBodyScrollLock`, `useNarrowViewport640` (`narrowAging`) | — |
| `formatCurrency`, `formatYmdLocal` (module-local in the tab), `stripTrailingZip`, `DEFAULT_JOB_LEDGER_PREFIX` + `formatJobLedgerNumberLabel` | — |
| Help guide [`see-which-paid-jobs-still-owe-supply-houses.md`](../../src/content/help/see-which-paid-jobs-still-owe-supply-houses.md) mentions the Make Payment picker's Job acct chip | a short *record a payment to a supply house* guide (or a section in that one) |

## The plan

1. **The link fix** (client-only, S): `applyPayment` writes `link` only when non-empty, and only where the invoice has none — one `update` per invoice group (with-link / without) or a per-row loop; kernel `paymentPayload` + test; rename the field and add the hint. Release note + fragment: a *fix* — say plainly that paying with the field blank used to erase the PDF link. Merge alone, first.
2. **The rebuild** (client-only, M): the kernel's remaining functions with tests; the modal — pinned title bar with the unpaid summary, *The payment* row (Paid on + hint · link), the chips, the table, the tri-state header box, the pinned footer with the running total and the amount-bearing button, the toast; `narrowAging` collapses the table to two lines per row (invoice + amount on one, due + job on the next). Release note + fragment + the guide.

## How to verify

- Dev login (Robert) → Materials → Supply Houses → expand **Reece** (the most unpaid invoices) → **Make Payment**. Expect the title's unpaid total to equal the aging row's *Total* for Reece; chips' counts to match; oldest-due first; the header box ticks all showing; *Past due* then the header box ticks just the late ones; the footer sum to track the ticks.
- **Do not press the green button on a real house.** The preview is prod. For the write path, use the ZZ Test bid's job or enter a throwaway invoice on a test house (there is no training account — see `HELP_MEDIA_PLAN.md`), tick it, set *Paid on* to yesterday, record, and read the row: Paid On shows yesterday, the PDF link is unchanged, the toast names the count and sum. Then Edit → *Not paid yet* → Save to undo (the trigger nulls `paid_at`).
- PR 1 alone: pay a throwaway invoice that has a link with the field blank → the link survives; with a link typed → only invoices without a link take it.
- Phone (375×812): the panel scrolls, the title bar and the footer stay pinned, the table collapses to two lines per row and never scrolls sideways.
- Gotchas: `formatYmdLocal` is module-local in `SupplyHousesTab.tsx` (parse date-only columns at local noon — `new Date('2026-07-10')` renders the previous day in Central); the invoice-form kernel's `paidAtIsoFromYmd` is company noon for the same reason; the in-app browser pane's dev-login worked on 2026-09-15 but has failed before — `docs/E2E_SMOKE.md` / the Playwright recipe is the fallback.
