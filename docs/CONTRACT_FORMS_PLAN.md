# Contract Forms — build plan (fill the real page)

---
file: docs/CONTRACT_FORMS_PLAN.md
type: Plan
purpose: Build plan for Contract Forms: a Contract Book entry can be an uploaded PDF with dev-placed entry boxes; the signer fills the real page (a W-9 first) in the existing signing flow; answers land in the PDF, the flattened copy is filed privately, and only non-sensitive answers are stored. A dev-only Form Studio places the boxes; scripts let an agent draft and preview a form from a PDF.
audience: Developers, AI Agents
last_updated: 2026-09-04
key_sections:
  - name: "Status"
  - name: "Why (ground truth, 2026-09-04)"
  - name: "Design decisions (defaults — veto here)"
  - name: "The shape"
  - name: "The PR train"
  - name: "Testing along the way"
  - name: "Guardrails"
---

## Status

> PR 10 publish step tracked in [`to-dos/contract-forms-publish-authored.md`](../to-dos/contract-forms-publish-authored.md) (2026-09-05 sweep).

**Ten PRs built (PR 6–10 on 2026-09-05); the W-9 is published in the Subs packet and was filled and signed end to end by the test sub; hand-filled forms can be entered from paper; two-party forms have an office section, the I-9 is published into All Teammates, and the DWC-83 into Subs.** Owner direction (rev 2 of the proposal, artifact `17017e46`): not a wizard, not a code catalog — the sub fills the **real one-page document** with entry fields the dev placed, and the dev adds documents through a **dev-only upload + placement studio**. "They're giving it right to the form they would have to give us anyway."

| # | PR | Version | Landed as |
|---|---|---|---|
| 1 | Schema + kernel + PDF executor + agent scripts (migration `20260904220000`, pushed) | v2.2788 | #2525 |
| 2 | Form Studio (dev-only tab in the Contract library) + Book entry + import/export (migration `20260904230000`, pushed) | v2.2794 | #2530 |
| 3 | Fill-on-the-document signer mode + `accept-contract` fills/flattens/files (4 fns redeployed 2026-09-04) | v2.2797 | #2534 |
| 4 | Staff record: facts card, Open PDF (gated + logged, new fn `open-contract-form-pdf`), Person Desk line | v2.2798 | #2535 |
| 5 | The W-9 itself (`docs/forms/w9-2024-03.schema.json`), published into the Subs packet, end-to-end tested with the test sub; signer page shows only pages with boxes | v2.2799 | PR 5 |
| 6 | Enter from paper (new fn `contract-form-paper-entry`, migration `20260905010500`, record modal scan door); the new-revision flow turned out to be the studio's Replace PDF… + Import PDF fields; Spanish labels already ride in the schema | v2.2801 | PR 6 |
| 7 | Two-party forms: `party` on boxes, office section completed from the record (new fn `complete-contract-form-office`, migration `20260905013000`), executor fixes (draw after flatten, dropdowns, per-op tolerance); the **I-9** (`docs/forms/i9-2025-01.schema.json`) published into All Teammates | v2.2802 | PR 7 |
| 8 | The office flow (owner-picked mockups): office-sections queue strip + Needs attention + row chip + Desk line, signer-side shading of the office half, attestation gate (`office_attested_at`, migration `20260905020000`), context + locked half in the office modal, PDF door labels, day-one hand-off from the thank-you page | v2.2803 | PR 8 |
| 9 | The **DWC-83** (Texas workers' comp joint agreement, two-party the other way: sub signs Part 3, office completes Parts 1–2; `docs/forms/dwc083-2021-10.schema.json`, all boxes drawn, template re-saved with `pdftocairo`) + the studio's PDF-repair hint | v2.2804 | PR 9 |
| 10 | Forms Click authors itself: `npm run forms:author` (pdf-lib page model that emits PDF + schema together); Direct Deposit Authorization; the four Texas § 53.284 lien waivers for subs. Drafted + previewed; publish after owner review | v2.2805 | PR 10 |

## Why (ground truth, 2026-09-04)

- A W-9 today is a `person_contract_documents` row with `doc_type = 'w9'` whose content is a **link** the office uploaded. No name, entity type, address, or TIN is captured. The compliance pill (`src/lib/people/subCompliance.ts`) reads only presence.
- The IRS W-9 (Rev. March 2024) is a real **AcroForm**: 23 named fields with rectangles on page 1 (`f1_01`…`f1_15`, checkboxes `c1_1[0..6]`, `c1_2[0]`; SSN 3-2-4 = `f1_11/12/13`, EIN 2-7 = `f1_14/15`; requester box `f1_09`). Only the Part II signature and date lines have no field.
- Everything downstream of a signed row already works for a form: Subs HQ pills, the portal's paperwork card, the Person Desk rollup, packets, sends, "Sign now", the dashboard prompt.
- Lessons carried from the owner's govtooling WH-347 tool: bundle the unmodified official PDF and write onto it with pdf-lib; drag-to-place boxes with an inspector; sample values drawn live; half-point nudges. Different here: fill **by field name** when the PDF has fields (the studio imports them), draw only where it does not; the definition is **data in the database**, not exported TypeScript.

## Design decisions (defaults — veto here)

1. **A form is a Book entry.** `contract_template_documents.form_template_id` → `contract_form_templates`. Packets, sends, portal "Sign now", pills: unchanged.
2. **The signer fills the page, not a questionnaire.** Inputs are overlaid on the rendered PDF at the boxes' rects. On phones a **field lens** under the page magnifies the current box (label + help + input) and steps in the dev-set order; on desktop/tablet the lens is not shown.
3. **Sensitive boxes exist afterward only in the flattened PDF.** `splitFormValuesForStorage` strips them from `form_values` and keeps the last four in `form_hints`. Never emailed, never in logs or confirmation screens. Opening a signed PDF goes through one gated function that logs the open (`contract_form_pdf_opens`).
4. **Who opens signed PDFs:** dev, controller, pay-approved master (the Person Desk pay gate). Assistants do not.
5. **Studio location:** a dev-only third tab, **Forms**, in the Contract library modal (everything about documents stays in one place, per the library guide).
6. **Person copies learn nothing new.** A trigger resolves `person_contract_documents.form_template_id` from the applied Book entry (or a same-name published form) on write, so the packet / quick-send / add-document copy paths are untouched.
7. **Templates are private.** `contract-form-templates` bucket: dev uploads; the signer page fetches the PDF through the signing function with a short-lived URL. Signed PDFs: `contract-form-pdfs`, service-role only.
8. **Typed signatures use Great Vibes** (the face the typed line already shows on screen), embedded via fontkit; Times Italic is the fallback when the TTF cannot load. Drawn signatures embed the PNG.
9. **Requester block** is a `constant` box the dev sets in the studio; default text "Click Plumbing and Electrical" + office address, editable there.
10. **Paper path** ("Enter from paper", `form_source = 'paper'`) waits for PR 6, after the portal path is live.

## The shape

- **Kernel** `supabase/functions/_shared/formSchema.ts` (re-exported by `src/lib/forms/formSchema.ts`): `FormSchema` v1 = `pages`, `boxes` (`text | digits | checkbox | signature | date | constant`, each with `rect`, `order`, `label(Es)`, `help(Es)`, `required`, `sensitive`, `advanced`, `bind` / `bindSegments`, `mask`, `group`, `oneOf`, `prefill`, `text`, `dateMode`, `sample`), `groups` (exactly-one), `oneOfs` (mutually exclusive, e.g. SSN | EIN). Pure functions: `validateFormSchema`, `validateFormValues`, `applyPrefill`, `askedBoxes`, `splitFormValuesForStorage`, `buildFillPlan` → `FillOp[]`, `draftSchemaFromPdfFields`, geometry (`pdfRectToScreen` / `screenRectToPdf`), masks.
- **Executor** `supabase/functions/_shared/fillFormPdf.ts` (re-exported by `src/lib/forms/fillFormPdf.ts`): `readPdfFields(lib, bytes)` and `fillFormPdf(lib, bytes, plan, opts)` — pdf-lib passed in (`jobContractPdf.ts` precedent) so Deno (esm.sh), the browser, and vitest share one file. Bound ops fill by name; unbound ops draw with auto-shrink; unknown binds are returned in `skipped`, not thrown; flatten by default.
- **Schema** (migration `20260904220000_contract_form_templates.sql`): `contract_form_templates` (pdf path, `schema jsonb`, status draft|published|retired, supersession), `contract_template_documents.form_template_id`, `person_contract_documents.form_template_id / form_values / form_hints / form_pdf_storage_path / form_source`, `contract_form_pdf_opens`, trigger `set_form_template_on_write`.
- **Agent scripts** (vite-node, same kernel): `npm run forms:inspect -- form.pdf`, `forms:draft -- form.pdf --out schema.json`, `forms:preview -- form.pdf schema.json --out preview.pdf --png --boxes`. Import the JSON into the studio for placement; export round-trips. See `docs/CONTRACT_FORMS.md`.

## The PR train

1. **Schema + kernel** (this PR). Migration, kernel, executor, tests against the real W-9 fixture (`src/test/fixtures/fw9-2024-03.pdf`), scripts, Great Vibes TTF (OFL) under `public/fonts/`, docs.
2. **Form Studio.** Dev-only Forms tab in `ContractLibraryModal`: upload (private bucket), pdf.js backdrop, import built-in fields → boxes, drag/resize/inspect (port govtooling's `AnchorBox` / `Inspector`), sample values, client-side filled preview (pdf-lib in the browser), import/export JSON, publish → creates/updates the Book entry (audience `sub`, doc type carried by name). `hasContractSigningContent` accepts form rows; the contracts loaders select `form_template_id`.
3. **Fill on the document.** `get-contract-for-signer` returns `form: { schema, templateUrl, person }` for form rows; `ContractAccept` renders `ContractFormFill` (page canvas + overlay + lens + signature box + consent); `accept-contract` validates, fills, draws, flattens, uploads to `contract-form-pdfs`, writes values/hints/path and the usual signed fields. Sub portal "Sign now" unchanged.
4. **Staff record.** `PersonContractSignedRecordModal` facts card + **Open PDF** via new `open-contract-form-pdf` (JWT; dev / controller / pay-approved master; 5-minute signed URL; inserts an opens row). Person Desk paperwork rollup line ("W-9 · Individual · SSN ••••1234").
5. **The W-9.** Upload the IRS PDF in the studio, import fields, set labels / masks / constant / sensitive / group, publish, add to the Subs packet. Verify with the test sub.
6. **Paper + revisions + Spanish.** "Enter from paper" reuses the overlay with `form_source = 'paper'`; uploading a new revision carries boxes over by field name; `labelEs` / `helpEs` shown when the portal is in Español.

## Testing along the way

- **Kernel + executor:** vitest against the real W-9 — field read (23 fields, 6 pages), draft → fill → read values back unflattened → flatten leaves zero fields (PR 1, green).
- **Scripts:** the agent loop runs end to end on the fixture (PR 1, run by hand; `--png` needs poppler).
- **Studio:** render smoke for the boxes layer geometry; manual pass in the Browser pane via dev-login (PR 2).
- **Signer page:** render smoke for the overlay + lens with a fixture schema; manual pass with a real token on the test sub after the functions deploy (PR 3).
- **Functions:** unit-tested through the shared kernel; end-to-end on prod with the test sub (the house has no staging).

## Guardrails

- Sensitive values never leave the fill path: not in `form_values`, not in logs, not in mail, not in the thank-you screen.
- Templates and signed PDFs are private buckets; no public URLs, ever.
- Migrations additive; buckets and storage policies created out-of-band and recorded in `docs/CONTRACT_FORMS.md`.
- The agreement (prose) flow does not change.
- Every PR: version claimed, release note + docs fragment, guide where a flow changes, edge functions deployed after merge.
