---
title: merge two spellings of the same builder
category: Office
roles: dev, master_technician, assistant, controller
keywords: builder, GC, duplicate, two spellings, merge, keep separate, alias, H&I, same builder, why we lost, hit rate, split cards, identity
order: 74
---

A builder typed two ways — "H & I" and "H&I", "Acme Builders" and "ACME builders LLC" — used to be two cards on **Bids → Followup → Why we lost**, each with half the history and its own hit rate. Two things fix that now.

## Most spellings fold on their own

Case, punctuation, extra spaces, accents and "&" no longer count: "H & I" and "H&I" are one card, "José" and "Jose" are one person, "WATTS" and "watts" are one manufacturer chip. Nothing to do.

## When two names still look alike

If two cards could be the same builder but the rule can't be sure (say "Acme Builders" and "Acme Builders LLC"), an amber line appears above the cards:

:::example The prompt
These look like the same builder: **Acme Builders** and **Acme Builders LLC** — 7 lost bids between them. {{button:outline|Merge into Acme Builders}} {{button:outline|Merge into Acme Builders LLC}} {{button:outline|Keep separate}}
:::

- **Merge into …** folds the other spelling into the one you picked. Every lens that groups by builder reads the same answer, so the cards join everywhere on the next load. Nothing on the bids themselves changes; only the grouping does.
- **Keep separate** records that they are different and stops the prompt for that pair.

One pair shows at a time; answer it and the next one appears if there is one.

## Builders that are customers

A builder that is already a customer groups by the customer, not the name. If two of those are duplicates, merge them as customers instead: **Customers → Show similar**.

## Undoing a merge

Ask a dev: merges live in one small table, one row per spelling, and removing the row un-merges on the next load.
