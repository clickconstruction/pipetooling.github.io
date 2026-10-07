---
title: open just the Pipeline sections you use
category: Office
roles: dev, master_technician, assistant
keywords: pipeline, stages, sections, collapse, expand, ready to bill, faster, loading, jump, stage bar, scroll, headers, colors
order: 76
---
The Pipeline board loads only the sections you have open. Everything else stays collapsed, so the board opens in a blink.

A collapsed section still shows its live count and dollar total, without loading a single row. That keeps the board light on the database all day.

## How it works

- A fresh device starts with **Ready to Bill** open and everything else collapsed. Tap any section header, the ▶ line, to expand it. Its rows load right then. You will see a brief *— loading* next to the title.
- **Whatever you leave open is remembered on that device.** If you live in Working, open it once. Every visit after that loads Working from the start.
- Collapsed headers are not stale. The counts, totals, the 30+/90+ aging chips and **Capable of Being Billed** all stay live. They come from a lightweight stats read, even for sections that never load rows.

:::example A dispatcher's board
▶ Waiting 17 $272.3k &nbsp;·&nbsp; ▼ Working 31 $322.5k &nbsp;·&nbsp; ▼ Ready to Bill 6 $13.1k

Waiting stays collapsed all week — its 17 jobs are never fetched, but the header still shows the real count and total.
:::

## Jump between sections

A bar under the map lists every section with its count and its dollars. Click a section in the bar to open it and jump to it.

The bar stays at the top of the window while you scroll. The section you are scrolling through is lit in its color.

Each section header is a band in that same color. It is the color of that section's pins on the map. A section with nothing in it stays in the bar, greyed. Collections shows only while it has rows.

On a phone the stage chips at the top do the same job.

## When everything loads anyway

Some tools need the whole board. They fetch it automatically the moment you use them. Those are typing in **search**, the **#** number jump, and the GC, Development and Account-man filters, plus hidden groups. GC means the general contractor. The cross-section tools do too: Weekly money, GC Review, Accounts Receivable and the Capable of Being Billed breakdown. You never have to think about what is loaded. Using a tool loads what it needs.

While a search is active, the matching text **lights up amber** on every result. It lights in the job number, name, address, customer, GC and development. So you can see at a glance why each row matched.

**Paid in Full** works exactly as before. Expand it to load paid jobs on demand. The search chip or the # jump loads them too.
