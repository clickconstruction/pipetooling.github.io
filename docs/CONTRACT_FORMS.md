# Contract Forms — fill the real page

---
file: docs/CONTRACT_FORMS.md
type: Specialist
purpose: How a Contract Book entry becomes a fillable form (an uploaded PDF plus dev-placed entry boxes), the FormSchema reference, the agent workflow for drafting a form from a PDF, and the out-of-band storage setup.
audience: Developers, AI Agents
last_updated: 2026-09-04
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
      "sample": "Misses Taunya Rachelle"               // studio / preview only
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

## The Form Studio (dev-only)

People → Contracts → Contract library → **Forms** (`src/components/contracts/formStudio/`). `FormStudio` lists `contract_form_templates` and creates one from an uploaded PDF (`readPdfFields` → optional `mergeDraftedFields` → `createFormTemplate`, which uploads to the private bucket and inserts the row). `FormStudioEditor` renders the page (`PdfPageCanvas`, pdf.js) under `FormBoxLayer` (drag / resize / multi-select) beside `FormBoxInspector`; every schema change goes through `src/lib/forms/formStudioState.ts`. Toolbar: add by type, Import PDF fields, Merge → digits, Import / Export JSON (the same `FormSchema` the scripts produce), Replace PDF, Preview filled PDF (client-side `fillFormPdf`), Save, Publish (packet + document name + audience → one Book entry per template via `publishFormTemplate`). Guide: `build-a-fillable-form.md`.

## The signer's page (fill on the document)

`/contract/accept?t=…` (`src/pages/ContractAccept.tsx`) asks `get-contract-for-signer`; a form row comes back with `form: { schema, templateUrl, person, todayLabel }` and renders `ContractFormFill` (`src/components/contracts/formFill/`) instead of the prose body: every page via `PdfPageCanvas` at a fit-to-width scale, `FormFillOverlay` inputs at the boxes' rects, a phone lens under 760 px (`lensSequence`, Back / Next, progress, rarely-needed expander), an English / Español toggle (`labelEs` / `helpEs` + `fillString`). Values are prefilled from the roster (`applyPrefill`), validated client-side (`validateFormValues` → `errorsByBox`), and posted to `accept-contract` as `formValues` with the signature; the function validates again, fills, flattens, files, and stores only non-sensitive values. Kernel: `src/lib/forms/formFillState.ts`. Guide: `fill-and-sign-a-form-on-my-phone.md`.

## Fill semantics

- **Bound** box (`bind`): the PDF's own field is set (`setText` / `check`), so it renders with the form's native appearance and lands exactly. Binds the PDF lacks are reported in `skipped`, never thrown — a schema drafted against another revision degrades visibly instead of crashing a signing.
- **Unbound** box: text is drawn at the rect with auto-shrink to fit the width (min 5 pt), aligned per `align`; checkboxes draw an `X`; signatures draw the typed name in Great Vibes (fallback Times Italic) or the PNG, scaled to fit and vertically centred.
- **Flatten** (default): after filling, fields become page content. Tests pass `flatten: false` to read values back.
- **Dates**: `dateMode: 'today'` uses the company calendar label passed in `ctx.todayLabel`; the kernel never reads the clock.

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
