---
title: build a fillable form from a PDF
category: Office
roles: dev
keywords: forms, form studio, W-9, fillable PDF, boxes, contract library, sensitive, publish, schema JSON
order: 77
---
Some paperwork is not text to read and sign — it is a page to fill in: the IRS W-9, an insurance form, a license application. The **Form Studio** lets you upload that PDF once, place the entry boxes where the answers go, and publish it as a Contract Book document. From then on it rides every rail an agreement does: packets, {{button:blue|Send to…}}, the portal's {{button:blue|Sign now}}, the compliance pills. The signer fills the real page; nothing they type goes anywhere but onto that form.

## Create a form

1. **People → Contracts → {{button:blue|Contract library}} → Forms** (devs only).
2. {{button:outline|+ New form from a PDF}}: pick the PDF, give it a name and the issuer's revision label (e.g. *Rev. March 2024*), and choose the **paperwork type** — a W-9 form makes its copies count under the {{chip:green|W-9}} pill automatically.
3. Leave **Import its fillable fields as boxes** ticked when the PDF has them (the IRS W-9 has 23). {{button:blue|Create and open}}.

:::example No fillable fields?
Scanned or flattened PDFs have none. The studio still works: you place every box by hand and the answers are drawn at those positions.
:::

## Place and describe the boxes

The page renders on the left with the boxes over it; the inspector on the right describes the selected one.

- **Drag** to move, drag a **corner** to resize. **Arrow keys** nudge 0.5 pt, Shift for 5. **Shift-click** selects several. **Delete** removes.
- **Label** is what the signer sees for that box (plain words: *Your name as on your tax return*), with an optional Español label and a help line.
- **Type**: text, digits (masked, e.g. `###-##-####`), checkbox, signature, date (today or typed), or constant (printed every time — your company's name and address in the requester box).
- **Sensitive**: tick it for a Social Security number or EIN. The answer is masked after entry and exists afterward only inside the signed PDF, never on the person's row.
- **Group**: checkboxes that are "pick one of" share a group. **One-of set**: two boxes where the signer fills exactly one (SSN *or* EIN).
- **Merge → digits**: select the three SSN cells the PDF provides and merge them into one masked number; each segment still fills its own PDF field.
- **Rarely needed**: boxes the phone view skips unless the signer opens them (exempt codes, account numbers).

Solid borders fill the PDF's own field by name; dashed borders are drawn at their position. Both are flattened into the page when the signer submits.

## Preview, save, publish

- {{button:outline|Preview filled PDF}} fills the real PDF with each box's **sample value** and a typed sample signature. Tick *outline boxes in preview* to see red rectangles around every box while you calibrate.
- {{button:blue|Save}} keeps the draft. {{button:blue|Publish…}} picks the **packet** and the **document name** and creates the Contract Book entry (audience *sub* by default). Republish after edits; the entry keeps its place.

## Working with an agent

Hand an agent the PDF and say "help me draft this". It can run `npm run forms:inspect`, draft the schema with `forms:draft`, write the labels, render the filled page with `forms:preview --png`, and send you the image. When it looks right, paste the JSON into **Import JSON** in the studio, nudge anything that needs it, and publish.
