---
title: open just the Pipeline sections you use
category: Office
roles: dev, master_technician, assistant
keywords: pipeline, stages, sections, collapse, expand, ready to bill, faster, loading
order: 76
---
The Pipeline board now loads **only the sections you have open** — everything else stays collapsed showing its live count and dollar total, without loading a single row. That makes the board open in a blink and keeps it light on the database all day.

## How it works

- A fresh device starts with **Ready to Bill** open and everything else collapsed. Tap any section header (▶) to expand it — its rows load right then (you'll see a brief *— loading* next to the title).
- **Whatever you leave open is remembered on that device.** If you live in Working, open it once — every visit after that loads Working from the start.
- Collapsed headers aren't stale: the counts, totals, the 30+/90+ aging chips, and **Capable of Being Billed** all stay live from a lightweight stats read, even for sections that never load rows.

:::example A dispatcher's board
▶ Waiting (17) - $272.3k &nbsp;·&nbsp; ▼ Working (31) - $322.5k &nbsp;·&nbsp; ▼ Ready to Bill (6) - $13.1k

Waiting stays collapsed all week — its 17 jobs are never fetched, but the header still shows the real count and total.
:::

## When everything loads anyway

Some tools need the whole board, and they fetch it automatically the moment you use them: typing in **search**, the **#** number jump, the GC/Development/Account-man filters (and hidden groups), and the cross-section tools (Weekly money, GC Review, Accounts Receivable, Capable of Being Billed breakdown). You never have to think about what's loaded — using a tool loads what it needs.

**Paid in Full** works exactly as before: expand it (or use the search chip / # jump) to load paid jobs on demand.
