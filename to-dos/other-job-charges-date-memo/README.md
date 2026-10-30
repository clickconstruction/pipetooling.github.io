---
name: "Other job charges: a date, a memo, and amounts that read as money"
number: 215
group: ready
status: built 2026-10-29 · PR 1 (#6489), PR 3 and PR 2 (the columns; its migration is pushed before it merges) are up · left: the owner's look at the live row, then delete the folder
summary: >
  An Other job charge on the Costs tab is a description box, a number box and a trash can. The
  number shows as typed (39796.7), and there is nowhere to say when the charge applies or where
  it came from, so those go into the description and get cut off. Drawn: the amount with
  thousands commas and smaller cents, a date on the left of the row, a memo line under the
  description that appears when summoned, and an ESTIMATE prefix shown as a chip. Three PRs:
  the formatting (no schema), then the two columns, then the save that keeps a row's id.
next: the three PRs merge in order (1, 3, 2), PR 2 after `supabase db push` of its migration; the owner looks at a job's Other job charges; then this folder goes.
size: M
blocker: none — the owner picked B on 2026-10-29.
opinion: build B; ship the formatting first because it needs no schema change
---

# Other job charges: a date, a memo, and amounts that read as money (#215)

## The ask, in the owner's words (2026-10-29)

> Can you help me improve how this looks on the app? Can you have it show commas by default and
> make the cents visually smaller than the rest?

> I also notice there is no way to set a date or an additional memo line. Can you help me add
> these as well by creating a mock-up with all these changes and then asking yourself, is this
> the best we can do?

His screenshot is the job window's Costs tab with **Other job charges** expanded: six rows, each
a description cut at about sixty characters, a bare number (`39796.7`, `20577.41`, `80003.51`),
and a trash can. He had just had three rows written there by a cost batch whose descriptions
carry a date, the plan they came from and what would replace them, because the row has no other
place for any of it.

## What the app already knew

- A charge row is `jobs_ledger_materials`: `id`, `job_id`, `description`, `amount`,
  `sequence_order`, `source_bid_id`, `created_at`. No date the charge applies to, no memo.
- The form keeps it as `MaterialRow = { id, description, amount }`
  (`src/lib/jobs/jobFormTypes.ts`). The autosave's materials slice
  (`buildMaterialsSliceJson`, `materialInsertRows` in `src/lib/jobs/jobFormAutosaveSlices.ts`;
  `writeMaterialsSlice` in `src/lib/jobs/jobFormSliceWrites.ts`) **deletes every row for the job
  and re-inserts them** on each save, so a row's `id` and `created_at` do not survive an edit.
- The row is drawn by `src/components/jobs/JobFormPartsCostSection.tsx` ("Other job charges"
  accordion, v2.1142 hide-until-summoned rows): a text input, a `type="number"` input, a trash
  button; the accordion total already formats through `formatCurrency`.
- `MoneyDecimalAmountInput` (`src/components/MoneyDecimalAmountInput.tsx`) is the house money box:
  formatted with commas when blurred, raw digits while typing, commits on blur. It cannot draw the
  cents smaller, because an `<input>` has one font size.
- Cost batches (`docs/COST_BATCHES.md`) add a charge with `{ op: "other_charge", job_id,
  description, amount }`; the function admits it only when the description starts with
  `ESTIMATE`. The Costs packet (`src/lib/jobsDocuments/jobCostsPacket.ts`, `packet-other` table)
  prints description and amount.

## The mock-up

[`mockup.html`](./mockup.html) — three states: today, A (three boxes on one line), B (two lines:
date, description with an Estimate chip, amount above; memo underneath, summoned by **+ memo**),
B on a phone, and the "is this the best we can do" table.

## The decision

Build **B**. A was drawn and rejected: the memo is the long field and on one line it gets the
narrowest box. Open: whether the date should be required (drawn as defaulting to the day the row
is added, clearable) and whether the Bill preview's line references should show the memo (drawn
as printing in the Costs packet only).

## Is this the best we can do, are we being straightforward

- **A date column, not `created_at`**: `created_at` is when the row was typed and the save resets
  it; `charged_on` is carried through the save and is the only date that holds.
- **One date, not a period**: the end of the period says which quarter a share belongs to and
  sorts; the period itself is a phrase in the memo.
- **A memo, not a longer description**: the description is the printed label; the memo is the
  basis and the source. Two fields, two readers.
- **The Estimate chip is drawn from the `ESTIMATE —` prefix**, which stays in the data; the batch
  function's contract does not change.
- **No dollar sign**: the sibling rows and the total show none.
- **Row identity is a real defect we are not fixing here**: the delete-and-reinsert save means a
  batch-written row loses its id on the next autosave and the batch's revert cannot find it. PR 3.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| `jobs_ledger_materials` | the table, RLS for all 9 roles | `charged_on date null`, `memo text null` (append-only migration; policies already cover the row) |
| `src/types/database.ts` | generated | regenerate after the migration; its own `chore(types)` PR |
| `MaterialRow`, `buildMaterialsSliceJson`, `materialInsertRows`, `writeMaterialsSlice` | carry description + amount | carry `charged_on` + `memo` so the save keeps them |
| `JOBS_LEDGER_MATERIALS_EMBED` (`src/lib/jobsLedgerEmbedSelects.ts`) | selects the five columns | add the two |
| `JobFormPartsCostSection.tsx` | the row | the two-line row: date box, Estimate chip, formatted amount, summoned memo |
| new `src/lib/jobs/otherChargeAmountDisplay.ts` + test | — | kernel: split a number into `39,796` and `.70`; sanitize typing; parse |
| new `src/components/jobs/OtherChargeAmountInput.tsx` | — | the formatted box: display span when blurred, text input while focused, commits on blur |
| `cost_batch_apply` (`supabase/migrations/20260909161532_cost_batches.sql`) | `other_charge` takes job, description, amount | optional `charged_on`, `memo` on the op; `docs/COST_BATCHES.md` amended |
| `jobCostsPacket.ts` `packet-other` | description + amount | date column, memo in small type under the line |
| `src/content/help/job-window-tabs.md` | Costs tab guide | the row's date, memo and Estimate chip |

## The plan

1. **PR 1 — the amount reads as money** (no schema): the kernel + test, `OtherChargeAmountInput`,
   the row uses it, the accordion total draws its cents smaller, the Estimate chip. Render test
   covers blur/focus. Release note + fragment.
2. **PR 2 — the date and the memo**: migration, types regen (own PR), `MaterialRow` and the slice
   through the save, embed select, the two-line row with **+ memo**, the packet, the batch
   function's optional fields, help guide, release note + fragment.
3. **PR 3 — the save keeps a row's id**: `writeMaterialsSlice` upserts by id and deletes only the
   rows no longer present, so batch-written rows keep their identity and `created_at`. Tests on
   `jobFormSliceWrites`.

## How to verify

Open any job → Costs → Other job charges. Type `39796.7` in an amount and tab out: it reads
`39,796` with `.70` smaller; click back in: `39796.70` with the caret. Add a row: the date is
today; clear it; it stays empty after a reload. Press **+ memo**, type a sentence, reload: it is
there, under the description, and the description box is still full width. A row whose
description starts with `ESTIMATE —` shows the chip and the text after the dash. Print the Costs
packet: the other-charges table has the date and the memo. Dry-run a cost batch with an
`other_charge` carrying `charged_on` and `memo`: the after-image carries both.
