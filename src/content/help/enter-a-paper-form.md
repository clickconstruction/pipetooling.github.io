---
title: enter a form a sub filled out on paper
category: Office
roles: dev, master_technician, assistant, controller
keywords: contracts, forms, W-9, paper, scan, photo, enter from paper, keyed, signed on paper, compliance
order: 79
---
A sub hands you a W-9 they filled out by hand, or texts a photo of one. **Enter from paper** puts it on their row exactly the way a portal signing would: the answers typed into the form's own boxes, the scan filed as the source, the compliance pill green.

## Open it

1. **People → Contracts**, expand the person, click {{button:outline|+ Add document}}.
2. Pick **Enter from paper** (it appears once the library has at least one form).
3. If more than one form is published, choose which one.

:::example Why it looks like the signing page
It is the signing page. The same boxes the sub would fill on their phone are shown to you on the real page, so what you type lands where the sub would have typed it.
:::

## Type what is on the paper

- Click a box on the page and type **exactly what is written**, including anything the sub crossed out or left blank. The name box is prefilled from the roster; change it if the paper says something else.
- Checkbox groups (the W-9's classification line) take one choice.
- Sensitive boxes (a Social Security number) are masked as soon as you leave them. They are written into the PDF only; the row keeps the last four.
- Under the page, the line tells you how many boxes are typed and which **required** boxes are still blank. Blanks never stop you from filing; they are listed on the record so you can ask the sub for the rest.

## Attach the paper and say who signed it

1. {{button:outline|Attach a photo or PDF of the paper…}} — a phone photo is fine, up to 8 MB.
2. **Signed by (printed)** and **Date on the paper**, as written on the form.
3. Tick **I typed this exactly as it appears on the paper**.
4. {{button:blue|File as signed on paper}}.

In a hurry? {{button:gray|Skip the boxes, just file the scan}} files the photo on the person's row without typing anything (this needs the scan attached). The pill still goes green; the record says the boxes were not keyed.

## What you get

- The row shows {{chip:green|signed}} with the date on the paper, and on **People → Subs** the pill reads **W-9**.
- **View signed** opens the record: the typed answers, "signed on paper … by …, keyed in from paper", any required boxes left blank, {{button:outline|Open the filled PDF}} and {{button:outline|Open the paper scan}}. Opening either is limited to devs, controllers, and pay-approved masters, and each open is logged.
- The sub's portal lists the form under **Paperwork on file**.

The sub's signature is never typed for them: it stays on the scan, and the filled PDF's Sign Here line is left blank on purpose.
