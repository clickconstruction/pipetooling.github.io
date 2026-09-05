# Contract Forms — fill the real page

---
file: docs/CONTRACT_FORMS.md
type: Specialist
purpose: How a Contract Book entry becomes a fillable form (an uploaded PDF plus dev-placed entry boxes), the FormSchema reference, the agent workflow for drafting a form from a PDF, and the out-of-band storage setup.
audience: Developers, AI Agents
last_updated: 2026-09-05
key_sections:
  - name: "What a form is"
  - name: "FormSchema reference"
  - name: "Agent workflow: draft a form from a PDF"
  - name: "Fill semantics"
  - name: "Storage (out-of-band)"
  - name: "Files"
---

## What a form is

A **form** is a Contract Book entry (`contract_template_documents`) whose `form_template_id` points at a `contract_form_templates` row: an uploaded PDF in the private `contract-form-templates` bucket plus a `schema jsonb` describing the entry boxes a dev placed on it. Person copies (`person_contract_documents`) inherit `form_template_id` through the `set_form_template_on_write` trigger, so packets, quick send, "Sign now", and the compliance pills work as they do for prose entries. The signer fills the **real page**; on submit the answers are written into the PDF (by field name where the PDF has fields, drawn at coordinates where it does not), the result is flattened and filed in the private `contract-form-pdfs` bucket, and only the non-sensitive answers are stored on the row (`form_values`), with the last four of each sensitive answer in `form_hints`.

Plan and status: [`CONTRACT_FORMS_PLAN.md`](./CONTRACT_FORMS_PLAN.md).

## FormSchema reference

Source of truth: [`supabase/functions/_shared/formSchema.ts`](../supabase/functions/_shared/formSchema.ts) (types + pure functions; re-exported to the app by `src/lib/forms/formSchema.ts`).

```jsonc
{
  "version": 1,
  "pages": [{ "width": 611.98, "height": 791.97 }],     // PDF points, one per page
  "boxes": [
    {
      "key": "name",                 // [a-z0-9_]+, unique; values are keyed by it
      "type": "text",                // text | digits | checkbox | signature | date | constant
      "page": 1,                     // 1-based
      "rect": { "x": 58.6, "y": 660, "w": 517.4, "h": 14 },  // origin bottom-left (pdf-lib)
      "order": 10,                   // tab / lens order
      "label": "Your name as on your tax return",
      "labelEs": "Su nombre como aparece en su declaración",
      "help": "…", "helpEs": "…",
      "required": true,
      "sensitive": false,            // true → masked, never stored on the row, only in the PDF
      "advanced": false,             // true → the lens skips it unless "Rarely needed" is opened
      "bind": "topmostSubform[0].Page1[0].f1_01[0]",   // fill the PDF's own field; omit to draw at rect
      "maxLength": 80, "fontSize": 10, "align": "left",
      "prefill": "person_name",      // person_name | person_email | person_phone
      "sample": "Misses Taunya Rachelle",              // studio / preview only
      "party": "signer"              // signer (default) | office — office boxes are completed from the record afterwards (v2.2802)
    },
    { "key": "ssn", "type": "digits", "mask": "###-##-####",
      "bindSegments": ["…f1_11[0]", "…f1_12[0]", "…f1_13[0]"],  // one PDF field per mask segment
      "sensitive": true, "oneOf": "tin", "…": "…" },
    { "key": "cls_individual", "type": "checkbox", "group": "classification", "bind": "…c1_1[0]", "…": "…" },
    { "key": "requester", "type": "constant", "text": "Click Plumbing and Electrical\n12925 FM 20…", "bind": "…f1_09[0]", "…": "…" },
    { "key": "signature", "type": "signature", "rect": { "…": "…" }, "…": "…" },   // always drawn: typed (cursive) or PNG
    { "key": "date", "type": "date", "dateMode": "today", "…": "…" }               // today (company calendar) or typed
  ],
  "groups": [{ "key": "classification", "label": "Federal tax classification", "exactlyOne": true, "required": true }],
  "oneOfs": [{ "key": "tin", "label": "Taxpayer number", "required": true }]
}
```

Functions:

| Function | What it answers |
|---|---|
| `validateFormSchema(schema)` | Structural problems a save/import must refuse (bad keys, boxes off-page, digits without mask, unknown group…). |
| `validateFormValues(schema, values)` | Can this submission be signed? Required, digit counts, exactly-one groups, one-of sets, unknown keys. |
| `applyPrefill(schema, values, person)` | Roster prefill into empty boxes only. |
| `askedBoxes(schema)` | What the signer is actually asked (no constants, no auto dates), in order. |
| `splitFormValuesForStorage(schema, values)` | `{ values, hints }` — sensitive answers removed, last four kept. |
| `buildFillPlan(schema, values, ctx)` | `FillOp[]`: `setText` / `check` by bind, `drawText` / `drawImage` at rect. |
| `draftSchemaFromPdfFields(fields, pages)` | First-pass schema from a PDF's own fields (text → bound text box; sibling checkboxes → one exactly-one group). |
| `pdfRectToScreen` / `screenRectToPdf` | Studio and overlay geometry at a given px-per-point scale. |

Executor: [`supabase/functions/_shared/fillFormPdf.ts`](../supabase/functions/_shared/fillFormPdf.ts) — `readPdfFields(lib, bytes)` and `fillFormPdf(lib, bytes, plan, { cursiveFontBytes, fontkit, flatten, debugBoxes })`. pdf-lib is passed in (Deno imports it from esm.sh, the browser and vitest from node_modules).

## Agent workflow: draft a form from a PDF

Given "help me draft this form", an agent can produce the signer's exact page without opening the app:

```bash
# 1. What does the PDF already know?
npm run forms:inspect -- ~/Desktop/W9.pdf

# 2. First-pass schema from its fields (placeholders for labels)
npm run forms:draft -- ~/Desktop/W9.pdf --out /tmp/w9.json

# 3. Edit /tmp/w9.json: real labels (+ labelEs / help), required, sensitive,
#    promote digit fields to one masked `digits` box with bindSegments,
#    add `signature` / `date` / `constant` boxes for lines with no field,
#    set `sample` values so the preview reads like a real submission.

# 4. Look at it (PNG needs poppler's pdftoppm; --boxes outlines every rect)
npm run forms:preview -- ~/Desktop/W9.pdf /tmp/w9.json --out /tmp/w9-preview.pdf --png --boxes

# 5. Hand the PNG to the owner; when it is right, import /tmp/w9.json in the
#    Form Studio (Contract library → Forms), nudge boxes if needed, publish.
```

The IRS W-9 fixture used by the tests lives at `src/test/fixtures/fw9-2024-03.pdf` (a US government work).

**PDFs that will not load.** Some official PDFs ship with a broken cross-reference table — the Texas DWC-83 fails in pdf-lib with "Expected instance of PDFDict, but got instance of undefined". Re-save the file first (`pdftocairo -pdf in.pdf out.pdf`, or Print to PDF) and use that copy as the template; pdf.js renders the broken original but the fill executor cannot. Fields are usually lost in the re-save, so every box is then drawn at coordinates: `pdftotext -bbox-layout -f 1 -l N in.pdf out.html` gives each label's position (top-left origin; PDF y = page height − y), and the value area sits just below the label inside its table cell. The studio says the same when a PDF fails to load.

**The shipped W-9 schema** is checked in at [`docs/forms/w9-2024-03.schema.json`](./forms/w9-2024-03.schema.json): 22 boxes — name (prefilled from the roster), business name, the seven-way classification group (LLC letter and Other under *rarely needed*), 3b, the exempt / FATCA codes and account numbers as *rarely needed*, address and city / state / ZIP, the requester block as a constant, SSN and EIN as one masked `digits` box each in a required one-of set (both sensitive, each segment bound to its IRS field), the signature and date drawn on the Sign Here line (x 131 / 400, y 196). To re-create the form: Form Studio → New form from the IRS PDF (import fields off) → Import JSON → paste this file → Publish into the Subs packet as **W-9** with paperwork type W-9. Re-run `forms:preview` on it after any IRS revision to check the binds still resolve (`skipped` must stay empty).

## Enter from paper (v2.2801)

A sub hands the office a hand-filled form. **People → Contracts → person → + Add document → Enter from paper** opens `ContractFormPaperEntryModal`: the form's pages with the signer's overlay (`FormFillOverlay`, desktop scale, no lens, `signature={null}`), a scan attachment (photo / PDF ≤ 8 MB), "signed by (printed)" + "date on the paper", and the attestation checkbox. Filing posts to `contract-form-paper-entry` (`prepare` → schema + 15-minute template URL; `file` → fill + flatten with **no signature drawn**, upload `<id>/signed.pdf` + `<id>/source.<ext>` to `contract-form-pdfs`, insert the signed row with `form_source = 'paper'`, `form_scan_storage_path`, `form_keyed_by_user_id`). **Skip the boxes, just file the scan** files the scan alone (a `note` records it). Missing required boxes never block; `missingRequired` (`src/lib/forms/formPaperEntry.ts`) lists them on the record. The record modal shows the paper facts and two doors, **Open the filled PDF** / **Open the paper scan**, both through `open-contract-form-pdf` (`which`).

## Two-party forms: the office section (v2.2802)

Some forms are signed by one person and completed by another (the I-9: employee Section 1, employer Section 2). Each box has a `party` — `signer` (default) or `office`. `schemaForParty(schema, party)` returns the half one party sees (groups / one-of sets pruned), and every kernel function works on it unchanged:

- **Signing** (`accept-contract`) and **Enter from paper** validate and fill the signer's half. When `hasOfficeBoxes(schema)`, the PDF is filed **unflattened** with the filled fields read-only (`fillFormPdf(..., { flatten: false, readOnlyFilled: true })`).
- **The record** shows an *Office section* line; **Complete the office section** opens `ContractFormOfficeModal` — the filed PDF with only the office boxes over it — and posts to `complete-contract-form-office`, which fills the office boxes (`FillContext.office = { signature, todayLabel }` drives office signature and date boxes), flattens, overwrites `<id>/signed.pdf`, and stores `office_values` + who / when. One-shot.
- In the **studio**, the inspector's **Filled by** select sets the party; office boxes are hatch-shaded on the layer. `forms:preview` previews both parties (Sample Signer / Office Signer).

**The office flow (v2.2803).** `formParties.ts` (shared with Deno): `partyRegions(schema, party)` (one padded rect per page — the signing page hatches the office's, the office modal shades the signer's as locked), `officeSectionPending(row, twoPartyTemplateIds)`, `officeQueue(rows, ids)` (oldest signature first), `twoPartyTemplateIdSet(templates)`, `OFFICE_ATTESTATION`. People → Contracts loads the referenced templates' schemas once, shows the **Office sections to complete** strip (Complete → office modal), counts pending sections into *Needs attention*, and chips the row; the Person Desk paperwork line says `· office section pending`. `?tab=contracts&doc=<id>` opens a record (the thank-you page's day-one hand-off). The office modal requires the attestation (`attested: true` → `office_attested_at`).

The shipped I-9 schema is `docs/forms/i9-2025-01.schema.json` (Section 1 = signer, Section 2 = office; the employer's business name and address are constants — edit them in the studio if the entity changes).

**The shipped DWC-83 schema** is `docs/forms/dwc083-2021-10.schema.json` (Texas DWC Form 083 Rev. 10/21, the joint agreement between a hiring contractor and an independent contractor). Two-party the other way round from the I-9: the **sub** signs Part 3 (name, federal tax ID as sensitive text, address, email, the item-19 affirmation group, signature + date on page 3); the **office** completes Parts 1–2 (agreement-type group, the employer-employee items under *rarely needed*, Click's name and address as constants, Click's EIN and email, the item-12 affirmation group, signature + date on page 2). No fillable fields in the PDF — all boxes are drawn; the template is the `pdftocairo` re-save. Published into the Subs packet as **DWC-83 Workers' comp agreement**.

## New revisions of a form

When the IRS (or anyone) issues a new PDF: open the form in the studio, **Replace PDF…** (boxes are kept; pages re-measured), then **Import PDF fields** (adds only fields no box binds yet), fix labels, **Preview filled PDF**, republish. Person copies already signed are untouched; new copies use the new PDF. From the terminal, `npm run forms:preview -- new.pdf docs/forms/<schema>.json --out /tmp/p.pdf` prints any binds the new PDF no longer has as `skipped` — that list must be empty before republishing.

## The Form Studio (dev-only)

People → Contracts → Contract library → **Forms** (`src/components/contracts/formStudio/`). `FormStudio` lists `contract_form_templates` and creates one from an uploaded PDF (`readPdfFields` → optional `mergeDraftedFields` → `createFormTemplate`, which uploads to the private bucket and inserts the row). `FormStudioEditor` renders the page (`PdfPageCanvas`, pdf.js) under `FormBoxLayer` (drag / resize / multi-select) beside `FormBoxInspector`; every schema change goes through `src/lib/forms/formStudioState.ts`. Toolbar: add by type, Import PDF fields, Merge → digits, Import / Export JSON (the same `FormSchema` the scripts produce), Replace PDF, Preview filled PDF (client-side `fillFormPdf`), Save, Publish (packet + document name + audience → one Book entry per template via `publishFormTemplate`). Guide: `build-a-fillable-form.md`.

## The signer's page (fill on the document)

`/contract/accept?t=…` (`src/pages/ContractAccept.tsx`) asks `get-contract-for-signer`; a form row comes back with `form: { schema, templateUrl, person, todayLabel }` and renders `ContractFormFill` (`src/components/contracts/formFill/`) instead of the prose body: every page via `PdfPageCanvas` at a fit-to-width scale, `FormFillOverlay` inputs at the boxes' rects, a phone lens under 760 px (`lensSequence`, Back / Next, progress, rarely-needed expander), an English / Español toggle (`labelEs` / `helpEs` + `fillString`). Values are prefilled from the roster (`applyPrefill`), validated client-side (`validateFormValues` → `errorsByBox`), and posted to `accept-contract` as `formValues` with the signature; the function validates again, fills, flattens, files, and stores only non-sensitive values. Kernel: `src/lib/forms/formFillState.ts`. Guide: `fill-and-sign-a-form-on-my-phone.md`.

## Fill semantics

- **Order** (v2.2802): field ops (`setText` / `check`) first, then **flatten**, then draw ops. Drawing after flattening means a field's flattened appearance can never cover drawn text (the I-9's State dropdown did exactly that before).
- **Bound** box (`bind`): the PDF's own field is set, so it renders with the form's native appearance and lands exactly. **Dropdowns** (combo boxes) are filled by selecting the option that matches the text (case-insensitive).
- **Tolerance** (v2.2802): a field op that fails — unknown name, `maxLength` overflow, an option the dropdown lacks — is never fatal. Bound ops carry `page` / `rect` / `align`, so the text is drawn at the box instead, and the case is reported in `skipped` as `name (reason)`. A schema drafted against another revision degrades visibly instead of crashing a signing. Single-bound `digits` boxes write the **formatted** string, so a comb field with `maxLength` (the I-9's 9-cell SSN) needs a mask without separators (`#########`).
- **Unbound** box: text is drawn at the rect with auto-shrink to fit the width (min 5 pt), aligned per `align`; checkboxes draw an `X`; signatures draw the typed name in Great Vibes (fallback Times Italic) or the PNG, scaled to fit and vertically centred.
- **Flatten** (default): after filling, fields become page content. Tests pass `flatten: false` to read values back; the two-party signer stage passes `flatten: false, readOnlyFilled: true`.
- **Dates**: `dateMode: 'today'` uses the company calendar label passed in `ctx.todayLabel` (office boxes: `ctx.office.todayLabel`); the kernel never reads the clock.

## Storage (out-of-band)

Buckets and their `storage.objects` policies are created out-of-band, like every other bucket here (done 2026-09-04 through the management API's `database/query` endpoint), and recorded below.

```sql
insert into storage.buckets (id, name, public) values ('contract-form-templates', 'contract-form-templates', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('contract-form-pdfs', 'contract-form-pdfs', false) on conflict (id) do nothing;

-- Templates: devs upload/replace/delete; nobody reads client-side (the signer page gets a signed URL from the function).
drop policy if exists "Devs manage contract form templates" on storage.objects;
create policy "Devs manage contract form templates" on storage.objects
  for all to authenticated
  using (bucket_id = 'contract-form-templates' and public.is_dev())
  with check (bucket_id = 'contract-form-templates' and public.is_dev());

-- Signed PDFs: no client policies at all — service role only (accept-contract writes, open-contract-form-pdf mints links).
```

## Files

| File | Role |
|---|---|
| `supabase/functions/_shared/formSchema.ts` | Kernel (types, validation, fill plan, drafting, geometry) |
| `supabase/functions/_shared/fillFormPdf.ts` | pdf-lib executor + field reader |
| `src/lib/forms/formSchema.ts`, `src/lib/forms/fillFormPdf.ts` | App re-exports |
| `src/lib/forms/*.test.ts` | Kernel tests + real-PDF fill tests |
| `scripts/forms/{inspect,draft,preview}.ts` | Agent workflow (vite-node) |
| `public/fonts/GreatVibes-Regular.ttf` (+ OFL) | Typed-signature face embedded in PDFs; excluded from the SW precache |
| `supabase/migrations/20260904220000_contract_form_templates.sql` | Schema (PR 1) |
| `supabase/migrations/20260904230000_contract_form_templates_doc_type.sql` | Form doc type → person copies (PR 2) |
| `src/components/contracts/formStudio/*` | Form Studio (PR 2) |
| `src/components/contracts/formFill/*`, `src/lib/forms/formFillState.ts` | Signer's fill-on-the-document mode (PR 3) |
| `src/lib/forms/formRecord.ts`, `PersonContractSignedRecordModal.tsx`, `supabase/functions/open-contract-form-pdf/` | Staff record + gated, logged PDF open (PR 4) |
| `src/lib/forms/formStudioState.ts`, `src/lib/forms/formTemplateRepo.ts` | Studio kernel + data access (PR 2) |
