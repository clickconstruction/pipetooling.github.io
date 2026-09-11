---
title: estimate labor hours on a bid with the New Labor view
category: Bids & Estimating
roles: dev, master_technician, estimator, assistant
keywords: labor, hours, labor book, alias, plan code, queue, crew-days, revenue per field hour, usable as a budget, old, new, cost estimate, fill from the book, save and learn
---
**Bids → Labor** turns a bid's count sheet into hours. Since v2.3276 the selected-bid card carries two pills beside {{button:blue|Print}}: {{chip:gray|Old}} — the HOURS grid you know — and {{chip:blue|New}}. Your pick is remembered on this device. Old stays the default until New has proved out.

## What the head tells you

The top of New answers two questions before you read a single row.

**Usable as a job budget?** A bar and a few chips: {{chip:green|hours on 22 of 26 rows}} {{chip:yellow|4 rows need hours ↓}} {{chip:green|rate set}} {{chip:green|materials from takeoff}}. The estimate is usable when at least nine rows in ten carry hours and a labor rate is set — that is the same reading the job will use to burn against this estimate after the bid is won.

**Does the whole bid make sense?** Five tiles: **Field hours** by stage, **Crew-days** (two techs, eight hours), **Labor $** at the rate, **Footage share** (how much of the labor sits on pipe rows), and **Revenue per field hour** — the bid value divided by the hours. A number far above what finished jobs run means the hours are light or the bid is fat; either way, look before it goes out.

## The queue: answer once, the book learns

Rows with no hours yet sit in an amber box at the top, in sheet order. Each row shows what the book thinks it is:

- *reads as Toilet (by alias) — hours from the book*: the book already knows this row. {{button:blue|Fill 2 from the book}} takes every row like it in one tap and never touches hours you typed.
- *no match in the book*: the book has never seen this text. Pick what it means in **Read as…** — a book entry, **New book entry…** (type the fixture's proper name), or **Task · fixed hours** for a line that is not a fixture at all, like sawcutting — set the three stage hours, and press {{button:blue|Save & learn}}.

Saving writes the row right away. When the row's text was new to the entry you picked, the book learns it as an alias, so `WC 1&2` reads as Toilet on every future bid without asking. The head says what happened: *Saved · "WC 1&2" now reads as Toilet on every bid.*

:::example A plan code the book had never seen
`LAV2 ×6` — no match. Read as… **Lavatory**. The hours fill in from the book (0.5 / 0.5 / 0.5). Save & learn. Next month's bid with `LAV2` on it lands straight in the grid.
:::

## The grid: every row says where its hours came from

Under the queue, the filled rows: the row as the count sheet wrote it, the book's name under it when they differ, the count, the three stage hours (edit them here — they save on their own, like Old), the row's hours, and a chip: {{chip:blue|book · by alias}} means the book's hours untouched; {{chip:gray|✎ edited · book 1/1/1}} means you changed them and here is what the book said; {{chip:gray|✎ typed}} means no book entry matches and the hours were typed. The totals row counts each kind.

## What is still Old-only for now

The rate box, the sub-sheet prints, Vehicle Travel, Lodging and Meals, Estimators Time, Direct Costs and the Labor book panel sit under both views unchanged. Footage rows priced per 100 ft, a company crew rate from People, and the book checking itself against finished jobs come in later steps of this refresh.
