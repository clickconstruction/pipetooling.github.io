---
title: build a fillable form from a PDF
category: Office
roles: dev
keywords: forms, form studio, W-9, fillable PDF, boxes, contract library, sensitive, publish, schema JSON
order: 77
---
Some paperwork is not text to read and sign. It is a page to fill in, like the IRS W-9, an insurance form or a license application.

The **Form Studio** lets you upload that PDF once. You place the entry boxes where the answers go. Then you publish it as a Contract Book document. From then on it rides every rail an agreement does. That means packets, {{button:blue|Send to…}}, the portal's {{button:blue|Sign now}} and the compliance pills. The signer fills the real page. Nothing they type goes anywhere but onto that form.

## Create a form

1. Open **People → Contracts → {{button:blue|Contract library}} → Forms**. This is for devs only.
2. Tap {{button:outline|+ New form from a PDF}}. Pick the PDF. Give it a name and the issuer's revision label, for example *Rev. March 2024*. Choose the **paperwork type**. A W-9 form makes its copies count under the {{chip:green|W-9}} pill on its own.
3. Leave **Import its fillable fields as boxes** ticked when the PDF has them. The IRS W-9 has 23. Tap {{button:blue|Create and open}}.

:::example No fillable fields?
Scanned or flattened PDFs have none. The studio still works: you place every box by hand and the answers are drawn at those positions.
:::

## Place and describe the boxes

The page renders on the left with the boxes over it. The inspector on the right describes the selected one.

- **Drag** to move. Drag a **corner** to resize. **Arrow keys** nudge 0.5 pt, Shift for 5. **Shift-click** selects several. **Delete** removes.
- **Label** is what the signer sees for that box. Use plain words, like *Your name as on your tax return*. It has an optional Español label and a help line.
- **Type**: text, digits, checkbox, signature, date or constant. Digits are masked, for example `###-##-####`. A date is today or typed. A constant is printed every time, like your company's name and address in the requester box.
- **Sensitive**: tick it for a Social Security number or EIN. An EIN is an employer tax number. The answer is masked after entry. Afterward it exists only inside the signed PDF, never on the person's row.
- **Group**: checkboxes that are "pick one of" share a group. **One-of set**: two boxes where the signer fills exactly one, such as SSN or EIN.
- **Merge → digits**: select the three SSN cells the PDF provides and merge them into one masked number. Each segment still fills its own PDF field.
- **Rarely needed**: boxes the phone view skips unless the signer opens them. Exempt codes and account numbers are examples.

Solid borders fill the PDF's own field by name. Dashed borders are drawn at their position. Both are flattened into the page when the signer submits. Flattened means the answers become part of the page.

## Preview, save, publish

- {{button:outline|Preview filled PDF}} fills the real PDF with each box's **sample value** and a typed sample signature. Tick *outline boxes in preview* to see red rectangles around every box while you calibrate.
- {{button:blue|Save}} keeps the draft. {{button:blue|Publish…}} picks the **packet** and the **document name**. It creates the Contract Book entry, with audience *sub* by default. Republish after edits. The entry keeps its place.

## Working with an agent

Hand an agent the PDF and say "help me draft this". It can run `npm run forms:inspect`. It can draft the schema with `forms:draft`. The schema is the list of boxes as JSON. It can write the labels. It can render the filled page with `forms:preview --png` and send you the image. When it looks right, paste the JSON into **Import JSON** in the studio. Nudge anything that needs it, and publish.

## Forms with an office half

Some forms are signed by one person and completed by another. The I-9 is one. In the inspector, set **Filled by** to *the office* on the boxes the office completes. The signer never sees them. After the signer signs, the record offers **Complete the office section**. That fills those boxes on the filed PDF and finishes it. **Preview filled PDF** shows both halves with sample answers.

## A PDF that will not load

Some official PDFs are saved in a way the studio cannot read. The Texas DWC-83 is one. The studio tells you when that happens. Re-save the file. **Print to PDF** from any viewer works. Upload that copy instead. Re-saving usually drops the PDF's own fillable fields, so you place every box by hand.

## Forms we write ourselves

Some forms are ours, not a government's. The direct deposit authorization and the Texas lien waivers are examples. A dev builds those from source with `npm run forms:author`. That writes the PDF and its boxes together under `docs/forms/authored/`. Upload the PDF in the studio with **Import the PDF's fillable fields** off. Then **Import JSON** with the matching schema file. Publish as usual. To change the wording or the company address, change the source and re-run. Never edit the PDF by hand.
