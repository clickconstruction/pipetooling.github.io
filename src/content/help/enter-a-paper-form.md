---
title: enter a form a sub filled out on paper
category: Office
roles: dev, master_technician, assistant, controller
keywords: contracts, forms, W-9, paper, scan, photo, enter from paper, keyed, signed on paper, compliance
order: 79
---
A sub hands you a W-9 they filled out by hand, or texts a photo of one. Enter from paper puts it on their row the way a portal signing would.

**Enter from paper** does three things. The answers are typed into the form's own boxes. The scan is filed as the source. The compliance pill, the mark that says their paperwork is in, turns green.

## Open it

1. Go to **People → Contracts**. Expand the person and click {{button:outline|+ Add document}}.
2. Pick **Enter from paper**. It appears once the library has at least one form.
3. If more than one form is published, choose which one.

:::example Why it looks like the signing page
It is the signing page. The same boxes the sub would fill on their phone are shown to you on the real page, so what you type lands where the sub would have typed it.
:::

## Type what is on the paper

- Click a box on the page and type **exactly what is written**. Include anything the sub crossed out or left blank. The name box is prefilled from the roster. Change it if the paper says something else.
- Checkbox groups take one choice. The W-9's classification line is one such group.
- Sensitive boxes are masked as soon as you leave them. A Social Security number is one. They are written into the PDF only. The row keeps the last four.
- Under the page, a line tells you how many boxes are typed. It also lists which **required** boxes are still blank. Blanks never stop you from filing. They are listed on the record so you can ask the sub for the rest.

## Attach the paper and say who signed it

1. Click {{button:outline|Attach a photo or PDF of the paper…}}. A phone photo is fine, up to 8 MB.
2. Fill in *Signed by (printed)* and **Date on the paper**, as written on the form.
3. Tick **I typed this exactly as it appears on the paper**.
4. Click {{button:blue|File as signed on paper}}.

In a hurry? {{button:gray|Skip the boxes, just file the scan}} files the photo on the person's row without typing anything. This needs the scan attached. The pill still goes green. The record says the boxes were not keyed.

## What you get

- The row shows {{chip:green|signed}} with the date on the paper. On **People → Subs** the pill reads **W-9**.
- **View signed** opens the record. It shows the typed answers and the line *signed on paper … by …, keyed in from paper*. It lists any required boxes left blank. It holds {{button:outline|Open the filled PDF}} and {{button:outline|Open the paper scan}}. Opening either is limited to devs, controllers and pay-approved leaders. Each open is logged.
- The sub's portal lists the form under **Paperwork on file**.

The sub's signature is never typed for them. It stays on the scan. The filled PDF's Sign Here line is left blank on purpose.
