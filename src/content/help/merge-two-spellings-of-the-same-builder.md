---
title: merge two spellings of the same builder
category: Office
roles: dev, master_technician, assistant, controller
keywords: builder, GC, duplicate, two spellings, merge, keep separate, alias, H&I, same builder, why we lost, hit rate, split cards, identity
order: 74
---

A builder typed two ways used to be two cards on the Why we lost list. Two things fix that now.

Take "H & I" and "H&I", or "Acme Builders" and "ACME builders LLC". Each spelling was its own card on **Bids → Followup → Why we lost**. Each card held half the history and its own hit rate, the share of bids won.

## Most spellings fold on their own

Case, punctuation, extra spaces, accents and "&" no longer count. "H & I" and "H&I" are one card. "José" and "Jose" are one person. "WATTS" and "watts" are one manufacturer chip. Nothing to do.

## When two names still look alike

Two cards could be the same builder, but the rule cannot be sure. Say "Acme Builders" and "Acme Builders LLC". Then an amber line appears above the cards:

:::example The prompt
These look like the same builder: **Acme Builders** and **Acme Builders LLC** — 7 lost bids between them. {{button:outline|Merge into Acme Builders}} {{button:outline|Merge into Acme Builders LLC}} {{button:outline|Keep separate}}
:::

- **Merge into …** folds the other spelling into the one you picked. Every lens, or view, that groups by builder reads the same answer. So the cards join everywhere on the next load. Nothing on the bids themselves changes. Only the grouping does.
- **Keep separate** records that they are different and stops the prompt for that pair.

One pair shows at a time. Answer it, and the next one appears if there is one.

## Builders that are customers

A builder that is already a customer groups by the customer, not the name. If two of those are duplicates, merge them as customers instead: **Customers → Show similar**.

## Undoing a merge

Ask a dev. Merges live in one small table, one row per spelling. Removing the row un-merges on the next load.
