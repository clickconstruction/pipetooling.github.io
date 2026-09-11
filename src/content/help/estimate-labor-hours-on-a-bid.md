---
title: estimate labor hours on a bid with the New Labor view
category: Bids & Estimating
roles: dev, master_technician, estimator, assistant
keywords: labor, hours, labor book, alias, plan code, queue, crew-days, revenue per field hour, usable as a budget, old, new, cost estimate, fill from the book, save and learn, per 100 ft, footage, task, fixed hours, sub line, source, crew rate, company rate, burden, overhead per field hour, bid labor, direct cost, margin
---
**Bids → Labor** turns a bid's count sheet into hours. Since v2.3276 the selected-bid card carries two pills beside {{button:blue|Print}}: {{chip:gray|Old}} — the HOURS grid you know — and {{chip:blue|New}}. Your pick is remembered on this device. Old stays the default until New has proved out.

## What the head tells you

The top of New answers two questions before you read a single row.

**Usable as a job budget?** A bar and a few chips: {{chip:green|hours on 22 of 26 rows}} {{chip:yellow|4 rows need hours ↓}} {{chip:green|rate set}} {{chip:green|materials from takeoff}}. The estimate is usable when at least nine rows in ten carry hours and a labor rate is set — that is the same reading the job will use to burn against this estimate after the bid is won.

**Does the whole bid make sense?** Five tiles: **Field hours** by stage, **Crew-days** (two techs, eight hours), **Labor $** at the rate, **Footage share** (how much of the labor sits on pipe rows), and **Revenue per field hour** — the bid value divided by the hours. A number far above what finished jobs run means the hours are light or the bid is fat; either way, look before it goes out.

## The queue: answer once, the book learns

Rows with no hours yet sit in an amber box at the top, in sheet order. Each row shows what the book thinks it is:

- *reads as Toilet (by alias) — hours from the book*: the book already knows this row. {{button:blue|Fill 2 from the book}} takes every row like it in one tap and never touches hours you typed.
- *no match in the book*: the book has never seen this text. First say what the row is with the three-way switch under its name — {{chip:blue|Fixture}} (hours × count), {{chip:gray|Task · fixed hours}} (a line like sawcutting: the hours are for the whole line), or {{chip:gray|Sub}} (a subcontractor's line — none of your crew's hours; price it under Direct costs → Subcontractors, and Save marks the row answered). For a fixture, pick what it means in **Read as…** — a book entry, or **New book entry…** (type the fixture's proper name) — set the three stage hours, and press {{button:blue|Save & learn}}.
- **Pipe rows read per 100 ft.** A footage row (`ft of 2IN WASTE ×729.5`) defaults the unit picker to *per 100 ft*, so you type the hours for a hundred feet and the row's hours come out as count ÷ 100 × hours. An entry made this way keeps *per 100 ft* in the book; the entry decides the unit whenever you pick one.

Saving writes the row right away. When the row's text was new to the entry you picked, the book learns it as an alias, so `WC 1&2` reads as Toilet on every future bid without asking. The head says what happened: *Saved · "WC 1&2" now reads as Toilet on every bid.*

:::example A plan code the book had never seen
`LAV2 ×6` — no match. Read as… **Lavatory**. The hours fill in from the book (0.5 / 0.5 / 0.5). Save & learn. Next month's bid with `LAV2` on it lands straight in the grid.
:::

## The grid: every row says where its hours came from

Under the queue, the filled rows: the row as the count sheet wrote it, the book's name under it when they differ (or *hours per 100 ft · 729.5 ft* for a pipe row), the count, the three stage hours (edit them here — they save on their own, like Old), the row's hours, and a chip: {{chip:blue|book · by alias}} means the book's hours untouched; {{chip:gray|✎ edited · book 1/1/1}} means you changed them and here is what the book said; {{chip:gray|✎ typed}} means no book entry matches and the hours were typed; {{chip:gray|sub · priced under direct costs}} is a sub's line with no hour cells at all. Hover a chip to read where the row came from — the entry and book, or what was learned on which bid. The totals row counts each kind.

The head also carries an **Other direct** tile — equipment, permits, subs, waste and other from the amber sections below, added up — so the bid's cost outside labor and materials is one glance.

## The crew rate: never blank

Under the tiles, the **Crew rate** card. The **company rate** is the last 90 days of recorded field wages from People (every closed clock session on a job, wage-priced) times the burden factor, so it reads like *company $35.76/h = $29.80 avg recorded field wage (90 d, 3,120 h) × 1.20 burden*. A bid with no rate of its own is costed at the company rate — the Labor $ tile, the "rate set" chip and the bottom line all read it. Press {{button:blue|save it on the bid}} to write that number onto the bid, so Pricing and the printed documents read the same rate; type your own in the rate box to override it ({{chip:blue|$35.00/h override}} · *use company rate* clears it).

Two facts sit beside the rate and are never added to the bid's cost: **Overhead / field hour** (the same lens A the Overhead tab shows) and **bid labor recorded** — the hours clocked on this bid, which already sit in the overhead pool. The old *Estimators Time* box is gone for the same reason: bid labor is recorded, not invented.

## The bottom line

Under the grid: **Direct cost of this bid** — labor at the effective rate, materials from the takeoff, driving, travel, other direct (equipment, permits, subs, waste, other), the total, and the margin at the bid value (amber under 20 %). *Open Pricing →* takes you to the Workbench, which reads the same number.

## Telling the book how an entry reads

In the **Labor book** panel, an entry's form has two new fields: **Reads as** (*Fixture · hours × count* or *Task · fixed hours for the line*) and **Hours are per** (*each* or *per 100 ft*). Mark your pipe entries per 100 ft once and every bid's footage rows fill in right. The entries table tags them {{chip:gray|per 100 ft}} and {{chip:gray|task · fixed hours}}.

:::example 2" waste, once
Add the entry *2" waste* · Reads as Fixture · Hours are per **per 100 ft** · RI 4 / TO 0 / TS 0 · Additional names `ft of 2IN WASTE`. On the next bid, `ft of 2IN WASTE ×729.5` lands in the grid at 29.2 hours with the chip *book · by alias · per 100 ft*.
:::

## What is still Old-only for now

The rate box, the sub-sheet prints, Vehicle Travel, Lodging and Meals, Estimators Time, Direct Costs and the Labor book panel sit under both views unchanged (Old's grid reads per-100-ft and task rows correctly too; it just cannot set them). A company crew rate from People and the book checking itself against finished jobs come in later steps of this refresh.
