---
name: "Pay run: a Payments view"
group: close
status: mock-up drawn 2026-09-17 · the owner chose flat + sort with the memo-derived chip the same day · PR 1 built and in the queue (#3377) · left: the two follow-ups if wanted, then delete
summary: >
  **A view of just the payments made** on People → Pay → Payroll: a third pill beside *Pay run ·
  Balances* — **Payments** — one row per payment (paid on, person, period, amount, memo, who
  recorded it), every header a sort, a window (30 d · 90 d · this year · all), the same name
  box also matching memo text, a total for what is visible, and *by week paid* / *by person*
  bands like the ledger's. Reads `pay_stub_payments` joined to `pay_stubs`; no new writes.
next: >
  Once #3377 lands, use it for a week. The two follow-ups the owner did not pick stay here as
  the options they are: the by-week-paid / by-person band modes (S), and a real method field on
  Record payment with a chip filter (M, one migration). Delete the folder when neither is wanted.
size: S (bands) · M (a method field)
blocker: A week of use; the two follow-ups are the owner's to want.
ver: mock-up 09-17
opinion: later — the flat list answers the ask; add bands or a method field only when the list shows it needs them.
---

# Pay run: a Payments view — one row per payment made, sortable

## The ask, in the owner's words

> on this page can I see a view of just the payments made? on this view I would like to be able to sort in various ways
>
> can you help me come up with a mockup before we build

(2026-09-17, on `people?tab=pay_stubs`.)

## The reading

- The Pay run ledger is one row per **pay stub** — a person's week — and shows *Paid to date* and *Balance*; a stub's payments live inside its **View**. The only list of payments in the app today is per person, in Employment's pay-history modal (`EmploymentPayHistoryModal`).
- Prod on 2026-09-17: **337 payments to 21 people since Mar 9** (`pay_stub_payments`: `paid_at`, `amount`, `memo`, `created_by`, `created_at`, `pay_stub_id` → `pay_stubs`: `person_name`, `period_start`, `period_end`). Memos are free text — *Cash App #D-P7PRK45K6*, *CashApp*, *Mercury*, *Paid via Client Mehow*, arithmetic notes — so there is no method column to sort on.

## The mock-up

[`before-after.html`](./before-after.html) — the Pay run ledger as it is, then the same page with the **Payments** pill on: the flat sortable table with eight real rows, and the *by week paid* band mode. The assumptions block carries the three questions.

## The decision

**2026-09-17, the owner:** *"go with your recommendation, flat plus sort with the derived chip."* Built the same day as PR 1 (#3377): the Payments pill, the flat sortable table, the window, the name-or-memo search, the total, the memo-derived chip. The two follow-ups below stay as options.

### As proposed

A third pill on the existing *Pay run · Balances* toggle — the tab already has the device — not a new sub-tab. Flat by default (newest first); every header sorts; *by week paid* and *by person* reuse the ledger's tinted band row (v2.3318). Window 90 d by default. The name box matches memo text too.

**Questions for the owner** (in the mock-up):

1. **Method** — derive a chip from the memo (*Cash App*, *Mercury*, none), or add a real `method` field on Record payment (Cash App · Mercury · check · client-direct · other)? Deriving is a kernel and no migration; the field is one migration and a Record-payment change, but then the chip is always right and filterable.
2. **Modes** — flat + sort only for day one, or the three modes (flat · by week paid · by person)?
3. **Recording** — does *Record payment* also live on this view (ask for person and week first), or is the ledger row the only place money gets recorded?

## Where it plugs in

| Exists | Change |
|---|---|
| [`PeoplePayStubsTab.tsx`](../../src/components/people/PeoplePayStubsTab.tsx) — the ledger, the *Pay run · Balances* toggle, `ledgerPayPeriodShortLabel`, the week bands (`buildPayRunWeekBands`) | the **Payments** pill; a `PayRunPaymentsView` component under it |
| [`EmploymentPayHistoryModal.tsx`](../../src/components/people/EmploymentPayHistoryModal.tsx) — the per-person payments query (`pay_stub_payments` + `pay_stubs!inner`) | the same query without the person filter, windowed by `paid_at` |
| `src/lib/people/ledgerPaidSegments.ts`, `payRunWeekBands` | a new `src/lib/people/payRunPayments.ts` kernel: sort, window, memo search, bands by week paid / by person, totals, the memo-derived method (+ tests) |
| Guide *see where someone stands on pay* | a section *See every payment made* |

## The plan

1. **PR 1 (S)** — the kernel + tests, the view (flat + sort + window + search + total), the pill, the guide. Client only.
2. **PR 2 (S)** — the two band modes, if wanted (question 2).
3. **PR 3 (M)** — a `method` column + Record payment field + the chip filter, if wanted (question 1).

## How to verify

`/dev-login?as=1&to=/people?tab=pay_stubs` → the Payments pill → 90 d shows the last three months' payments newest first; click *Amount* twice and the largest is first; type *D-P7PR* and the two Cash App transfers remain; *All* lists 337 rows with the total matching the sum of every stub's *Paid to date*. Nothing is written.
