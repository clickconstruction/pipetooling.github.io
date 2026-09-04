---
title: record sub labor on a job
category: Office
roles: dev, master_technician, assistant, controller
keywords: sub labor, subcontractor, sub sheet, labor book, job picker, stage, walk-through, waiting on customer
order: 62
---
Sub labor lives on **Jobs → Sub Labor**. Every entry belongs to a job — the New Sub Labor form starts with the standard job search, and everything downstream (the job's profit band, Crew P&L, sub sheets) rolls the cost up to that job automatically.

## New entry — three quick steps

{{button:blue|New Sub Labor}} opens a short three-step form (built for phones, same on desktop) with a progress bar up top. Enter moves you forward; {{button:outline|Back}} never loses what you typed.

1. **Job** — tap the field to open the same job search Schedule uses: type a number, name, address, or customer, and every result shows its trade pill and what stage the job is in ({{chip:yellow|Working}}, {{chip:blue|Billed}}, and so on), finished jobs under their own divider. Picking the job shows its **address right under the name** — it comes from the job and isn't edited here (fix it in Edit Job if it's wrong). The pick also pre-selects the job's crew for the next step. Date and service type live here too.
2. **Crew** — the job's team arrives pre-selected as tappable chips; tap to add or remove people from External Subs, Internal Subs, or Office Team, or search across all three. {{button:blue|Add Sub}} creates a new external sub on the spot.
3. **Work and cost** — describe the work and its cost, or flip on **Itemize hours and rate**. Itemizing shows one card per line item: the work description up top, then labeled Count × Hrs each and Rate fields with the line's hours and cost computed on the right. Tap **Fixed hrs** on a line to enter total hours directly instead of count × hours. The bar under the cards totals items, hours, and dollars. The **Labor book** section fills line items from your book prices for the picked service type. {{button:blue|Save}} shows what's still missing right on the button until everything's in.

:::example Where did Distance go?
New entries no longer ask for miles — the drive-cost math simply isn't applied to them. Older entries keep their saved distance, keep paying out drive cost, and still show the field when edited.
:::

## Editing an entry

{{button:outline|Edit}} opens the same form on one page (no steps), with the same **Job** field at the top: the sheet's job shows as {{chip:blue|J977 · Hospital-415 Springtown Way}} with its address underneath, and **change** opens the same search to move the sheet to a different job. Under the title, one line tells you which sheet you're in — contractor · total · what's due.

- Moving a sheet to another job never touches the crew — it's already right; only the job and its address change.
- Sheets from before the picker (a typed number that matches no job, or no number at all) read {{chip:yellow|#H-2291 No job with this number}} and keep their typed **Address** box. Nothing re-links on its own; tap **link** to attach a job.

{{button:outline|Delete}} sits alone on the left, away from {{button:blue|Save}}.

## Where the sheet stands

The **Stage** column on the ledger says what you're waiting on for each sheet: {{chip:yellow|Waiting on work}} → {{chip:purple|Waiting on walk-through}} → {{chip:blue|Waiting on customer}}, and {{chip:green|Paid}} once the balance is $0. Tap **→** on the chip to advance one stage, or tap the chip to pick any of the three (stepping back is fine). The sub sees the same steps on their portal and can move a sheet to *Waiting on walk-through* themselves by telling you the work is done — the chip then reads *· sub* with their note behind ✎, and the job's Activity feed keeps the history. Details in [share a sub their portal](/help/share-a-sub-their-portal).
