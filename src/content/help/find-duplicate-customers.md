---
title: find and merge duplicate customers
category: Getting Started
roles: dev, master_technician, assistant, controller, estimator
keywords: duplicate customers, show similar, merge, dedupe, same address, same phone
order: 43
---
Duplicates sneak in — a retried save, two spellings of the same name, a customer entered from two different jobs. The Customers page can cluster them for you.

## Show similar

On **Customers**, click {{button:outline|Show similar (N)}} (top right, next to Show archived). The list switches to showing **only likely duplicates**, grouped, each group topped with an amber tag explaining the evidence:

:::example A duplicate group
**Possible duplicates (2) — matching name + address**

**John Ingram** · 1603 Sycamore Street Bandera, TX 78003
**John Ingram** · 1603 Sycamore Street Bandera, TX 78003
:::

Two customers land in a group when they share **any** of: name, address, phone, or email — compared loosely (capitalization, punctuation, and phone formatting don't matter; "(210) 889-1297" matches "+1 210 889 1297"). Matching is exact after that cleanup, so every group is explainable — no fuzzy guesses. Groups chain: if A and B share a phone and B and C share an address, all three show together.

## Merging a group

Click a customer's name in the group to open Edit, expand **Merge with another customer**, pick the other one, and merge — their jobs, bids, estimates, and projects all move to the survivor. Repeat until the group is one customer, then click {{button:outline|Show all}} to leave the view.

A pair in the list isn't necessarily a mistake — two customers can legitimately share an address (landlord and tenant) or a phone (spouses). The tag tells you the evidence; you make the call.
