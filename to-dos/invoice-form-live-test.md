---
name: Live-test the rebuilt invoice form
group: close
status: close out · v2.3476 is live (deployed 2026-09-15) · the signed-in pass on prod is owed
summary: >
  **Live-test the rebuilt supply house invoice form**: the eight-step script (PO hint, in-line job
  search, cards and the % split, Paid on, Open ↗, the Edit path on 3594445, phone width) — cancel
  everything, record nothing on a real house; delete the file when clean.
next: Sign in, run the script, note the date on the v2.3476 fragment, delete the file.
size: S
blocker: None — needs a signed-in prod session.
ver: v2.3476 live
---

# Live-test the rebuilt supply house invoice form (v2.3476)

## The ask, in the owner's words

"build all seven, test before we push it live, and test once live" (2026-09-15), then "is this live? Add to a to-do to test it."

## What to test — the pre-push script, on prod

Sign in as an office user (Robert or Taunya) → **Materials → Supply Houses** → expand **Ferguson** → {{button:blue|Add Invoice}}. **Cancel every form — record nothing on a real house.**

1. **Sections** read *From the invoice* · *Which job* · *Paying it* · *Paperwork*; the title bar (house name) and the Save footer stay pinned while the middle scrolls.
2. **Purchase order #** — type `PO 41207`: red *not on the PO Generator ledger for Ferguson — check the number*. Type `SpaceX`: *Hand PO — no PO Generator code*.
3. **Which job** — type `964` in the search box: the J964 · Pondhill row appears in-line (no second modal); pick it → a card with the address and the **On Ferguson's job account** checkbox + the amber *No job account at Ferguson on record* nudge with **Mark opened…** (do not press it). Type `1007`, pick it → two cards, **50 / 50 %** boxes appear, the account block disappears, the total line reads *100.0% · Job accounts are per property…*. Set the first to 70 → the second reads 30. × the second → back to one card, no % box.
4. **Paying it** — the due date is prefilled and the hint reads *Ferguson's payment day is the 10th.*; click **Paid on** → the date fills with today and enables; click **Not paid yet** → it clears and disables.
5. **Paperwork** — paste `https://drive.google.com/file/d/x/view` → **Open ↗** appears and opens a new tab.
6. **Edit** — tick *Show paid invoices*, pencil on **3594445** (PO 39089, on 273 · Dudley, paid 9/14): green *PO 39089 is on the PO Generator ledger for Ferguson*, the J273 card, **Paid on 09/14/2026** already selected, **Open ↗** beside the Drive link, **Delete** at the left of the footer. Cancel.
7. **Phone** — DevTools 375×812 (or a real phone): the three top fields and the Due/Status pair stack; header and footer stay pinned; nothing scrolls sideways.
8. **One real save, if the owner wants the write path proven**: on a test house or a throwaway invoice only — add with a job, *Paid on* set to yesterday, Save invoice → the table's Paid On reads yesterday; Edit → *Not paid yet* → Save changes → Paid On clears (the trigger nulls `paid_at`). Then delete the throwaway.

## If something is off

The form is one block in [`SupplyHousesTab.tsx`](../src/components/SupplyHousesTab.tsx) (`invoiceFormOpen && …`), logic in [`supplyHouseInvoiceForm.ts`](../src/lib/materials/supplyHouseInvoiceForm.ts) (26 tests). The record of what shipped: [`docs/recent-features/v2.3476.md`](../docs/recent-features/v2.3476.md). Mock-up: https://claude.ai/artifact/JD75n2iSRhjr6fgRytsTMt

When the pass is clean, note the date on the v2.3476 fragment's *Live-verified* line and delete this file.
