---
name: PO code — what they said they need
number: 25
group: ready
status: PR 1 shipped 2026-09-19 (v2.3599, #3412) · left: a live look at one real invoice, then the PR 2 call
summary: >
  When the office mints a counter PO code, the tech has just said what it is for — "40 ft of ¾" PEX", "a drain machine" — and nothing writes that down. The row already has a `notes` column and both forms already write it; the desktop form calls it "Optional notes…" and nothing reads it back. Option A: relabel Notes as **What they said they need** on both doors with a concrete placeholder, put the claim in the text to the tech, rename the ledger column, and show the matched ledger entry (job, person, claim) on the supply-house invoice form under the PO check — so $612 against "40 ft of PEX and two valves" is a question the office can ask the day the invoice arrives. No migration.
next: Watch whether the field gets filled for a couple of weeks (from 2026-09-19); then decide PR 2 (the kind chip) or close the to-do.
size: S
blocker: None.
ver: v2.3599
opinion: your call — PR 2 only if tool purchases on job POs turn out to be real.
---

# PO code: what they said they need

## The ask, in the owner's words (2026-09-18)

> I think that when a P.O. is generated there should be an opportunity for the assistant to write down what the person she is giving it to claimed he or she needed it for — such as what tools they planned on buying. I see this as a useful optional field.

## What exists (read from the code 2026-09-18)

- Every minted code is one row in `material_po_generator_entries` (`po_code`, `job_ledger_id`, `for_user_id`, `supply_house_id`, **`notes`**, `created_by`, `created_at`). Inserted only through `insert_material_po_generator_entry(p_job_ledger_id, p_for_user_id, p_supply_house_id, p_notes)`; the RPC's params are defaulted. No update RPC, no update policy — rows are immutable.
- **Two doors write it.** `MaterialsPoGeneratorTab.tsx` has a Notes textarea, placeholder *Optional notes…*. `DispatchModePo.tsx` has a one-line *Note (optional)*, placeholder *e.g. 40ft of 3/4 PEX* — the phone door already treats the note as the material.
- **One reader.** The two ledgers (desktop table, phone list) show the note. The text-to-tech body in Dispatch Mode (`resultSummary`) omits it. The supply-house invoice form's PO check (`supplyHouseInvoiceForm.ts` → `poCodeHint`, fed by `SupplyHousesTab.tsx`, which selects only `po_code`) says whether the code exists on the house's ledger and nothing else.
- Not affected: the PO Builder / Purchase Orders lane (line-item POs, a different table), the job-account line under the supply house, RLS, the deleted-records archive (whole row), the job-account evidence-gaps migration (reads ids and dates only).

## The decision — option A

Sharpen the field that exists; add nothing to the schema.

1. **Both forms**: label becomes **What they said they need** (optional), placeholder *e.g. 40 ft of ¾" PEX and two stop valves · a 2" drain machine · "just fittings"*. Desktop textarea stays; phone stays one line.
2. **Text to the tech** (Dispatch Mode): the claim is appended to the SMS body — `PO 48213 — Ferguson — J964 · Oak Ridge townhomes — for Marcus Delgado — 40 ft of ¾" PEX and two stop valves`. The tech reads what was written down; a claim they can see is a claim they own.
3. **Both ledgers**: column header / inline label becomes **Said they need**. Old rows read as they are.
4. **Invoice form** (Materials → Supply Houses → Add / Edit invoice): when the five-digit code matches the house's ledger, a card under the existing hint shows the entry — job, person, minted date and by whom, and the claim. This is the reader that makes the field worth filling.
5. Optional stays optional. The placeholder does the asking; the invoice card does the rewarding.

**Rejected.** *B — a second `stated_need` column beside Notes*: two optional boxes on a three-tap phone flow; the second gets skipped or the claim lands in the wrong box, and nothing on the phone uses Notes for anything but the claim today. *C — a Material / Tool / Other kind chip*: the only version that can flag a company tool landing in a job's material cost, but it needs a migration, a decision at the counter ("is a drain snake a tool?"), and an invoice-allocation warning to pay off. Ship it as its own PR only if A shows the claim gets written and tool purchases on job POs turn out to be real.

**Left out on purpose.** Editing a claim after the code is minted (needs a new update function with its own who-may rule; wait to see how many "—" rows A leaves). Making the field required (a required box at the counter gets "stuff" typed into it, which is worse than blank).

## Mock-up

`po-generator-stated-need-mockups.html` beside this file: today's three screens, options A / B / C side by side, the four readers drawn for A (C's chip drawn where it would matter), and the two things left out. Published copy: https://claude.ai/artifact/5vbUpa3ufx1JU8ZSrbX8TN

## Where it plugs in

| Piece | File | Exists / new |
|---|---|---|
| Desktop form + ledger table | `src/components/materials/MaterialsPoGeneratorTab.tsx` | label, placeholder, column header — edit |
| Phone form + ledger list + SMS body | `src/components/dispatchMode/DispatchModePo.tsx` | label, placeholder, `resultSummary` gains the claim — edit |
| Invoice PO check kernel | `src/lib/materials/supplyHouseInvoiceForm.ts` (+ `.test.ts`) | `poCodeHint` reads a `Set<number>` today; carry the matched entry (job label, person, created, claim) — extend, keep the three hint kinds |
| Invoice form | `src/components/SupplyHousesTab.tsx` | the ledger query selects `po_code` only; select the entry fields and render the card under the hint — edit |
| Guides | `src/content/help/raise-a-purchase-order.md`, `src/content/help/dispatch-mode.md` | the field's new name and the invoice card — edit |
| Release note + fragment | `src/content/releaseNotes/v2.NNNN.ts`, `docs/recent-features/v2.NNNN.md` | new (claim the number with `npm run claim`) |
| Schema / RPC / RLS / `database.ts` | — | untouched |

## The plan

**PR 1 (S)** — everything in the decision above, one PR. Kernel first: extend `poCodeHint` so the invoice card renders from a pure function with a test for each hint kind plus "matched, no claim". Then the four surfaces, the two guides, the note + fragment.

**PR 2 (later, M, only if wanted)** — option C: `kind` enum column (`material` default · `tool` · `other`), one more defaulted RPC param, chips on both forms, a chip on both ledgers, and an amber line on the invoice form when a Tool PO's invoice is allocated to the job. Its own migration, docs and to-do.

## How to verify (PR 1)

1. `/dev-login?as=1&to=/materials?tab=po-generator` — the field reads *What they said they need*; mint a code with a claim; the ledger's **Said they need** column shows it; mint one without — the row reads —.
2. Dispatch Mode → PO on a phone-width window: same label; after Generate the claim sits under the code; **Text to …** opens `sms:` with the claim at the end of the body.
3. Materials → Supply Houses → the house you minted against → Add invoice: type the code in PO # — the green hint stays, and the card below it shows job · person · date · claim. Type a code minted with no claim — the card shows the row without the claim line. Type a code from another house — the amber hint as today, no card.
4. `npm test` (kernel + render smokes), `npm run check:todo-drift`.

## Where it stands

Designed and decided 2026-09-18. **PR 1 shipped as v2.3599** (#3412, merged 2026-09-19): the kernel `src/lib/materials/poCodeStatedNeed.ts`, `poLedgerEntryCard` in `supplyHouseInvoiceForm.ts`, the four surfaces, both guides, GLOSSARY. Left: a live look at one real invoice against a code minted with a claim. PR 2 (option C) is not started and not decided.
