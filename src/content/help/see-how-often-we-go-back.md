---
title: see how often we go back
category: Office
roles: dev, master_technician, assistant, controller
keywords: rework, return visit, callback, went back, warranty, same address, rate by tech, job summary
order: 44
---

Profit says nothing about whether we had to come back. **Rework** finds the return visits from what's already on every job — its address — and turns them into a rate.

## Where it is

Go to **Jobs → Job Summary** and switch **View** to {{chip:blue|Rework}}. It runs on every job the page knows, not just the window, because the first visit may be months before the second.

## What counts as a return

A second job at the **same address** that started within the window — {{chip:blue|30 d}}, {{chip:blue|90 d}}, or {{chip:blue|180 d}} — after the first job was billed. Addresses match by the customer's address record first, then by the street text with suite and unit numbers ignored. A job with no usable address can't be placed and is counted in the last tile.

## Callbacks or all returns

**Count** decides which returns make the rate. {{chip:blue|unbilled returns}} — the default — keeps only returns that billed nothing: the warranty-shaped ones. A return still in progress is counted but tagged {{chip:yellow|still open}} in the pairs table, since it may yet be billed; the control row says how many. {{chip:blue|all returns}} adds billed second jobs at the same address, which at a restaurant or a builder's site is usually repeat work, not rework. The control row says how many billed returns were set aside.

## The rate

**Rate by** lead tech, service type, or GC. Each return is credited to the **first** job's group, and the rate is returns over that group's finished jobs, so a tech with three jobs and one callback reads 33%. Groups need two finished jobs to be ranked. The dashed line is the company rate.

:::example One tech, two stories
A 12% rate with a $9,000 cost of going back is a training conversation. A 12% rate where every return is a new scope at a builder's site is a sales pattern. The pairs table tells them apart.
:::

## The pairs

Every return listed: the first job and when it was billed, the return and when it started, the days between, and what the return cost in labor, subs, parts, and overhead. Click either job number to open it on the Jobs view.

## Watch-outs

- A planned second phase, or a genuinely new scope at the same address, counts as a return today. Marking a pair "not rework" is a follow-up, so read the list before reading the rate.
- Jobs with no invoice use their paid date, then their last field day, as the "done" date.
