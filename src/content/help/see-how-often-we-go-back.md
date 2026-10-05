---
title: see how often we go back
category: Office
roles: dev, master_technician, assistant, controller
keywords: rework, return visit, callback, went back, warranty, same address, rate by tech, job summary
order: 44
---

Profit says nothing about whether we had to come back. **Rework** finds the return visits and turns them into a rate.

Rework finds them from something every job already has: its address.

## Where it is

You go to **Jobs → Job Summary** and switch **View** to {{chip:blue|Rework}}. The Rework view runs on every job the page knows, not just the page's window. The reason is that the first visit may be months before the second.

## What counts as a return

A return is a second job at the **same address**. The second job started soon after the first job was billed. You pick how soon with **Window**: {{chip:blue|30 d}}, {{chip:blue|90 d}} or {{chip:blue|180 d}}. Addresses match by the customer's address record first. Next, addresses match by the street text, with suite and unit numbers ignored. A job with no usable address can't be placed. The last tile counts those jobs.

## Callbacks or all returns

**Count** decides which returns make the rate. {{chip:blue|unbilled returns}} is the default. The default keeps only returns that billed nothing: the warranty-shaped ones. A return still in progress is counted. The pairs table tags it {{chip:yellow|still open}}, since the return may yet be billed. The control row says how many. {{chip:blue|all returns}} adds billed second jobs at the same address. At a restaurant or a builder's site, that is usually repeat work, not rework. The control row says how many billed returns were set aside.

## The rate

You set **Rate by** to lead tech, service type or GC, the general contractor. Each return is credited to the **first** job's group. The rate is the group's returns divided by its finished jobs. So a tech with three jobs and one callback reads 33%. Groups need two finished jobs to be ranked. The dashed line is the company rate.

:::example One tech, two stories
A 12% rate with a $9,000 cost of going back is a training conversation. A 12% rate where every return is a new scope at a builder's site is a sales pattern. The pairs table tells them apart.
:::

## The pairs

The pairs table lists every return. Each row shows the first job and when it was billed. The row shows the return and when it started, and the days between. The row also shows what the return cost in labor, subs, parts and overhead. You click either job number to open it on the Jobs view.

## Watch-outs

- A planned second phase counts as a return today. A genuinely new scope of work at the same address counts too. You cannot yet mark a pair "not rework". So read the list before you read the rate.
- A job with no invoice uses its paid date as the "done" date. With no paid date, it uses its last field day.
