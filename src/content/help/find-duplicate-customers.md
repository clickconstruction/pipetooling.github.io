---
title: find and merge duplicate customers
category: Getting Started
roles: dev, master_technician, assistant, controller, estimator
keywords: duplicate customers, show similar, merge, dedupe, same address, same phone
order: 43
---
Duplicates sneak in: a retried save, two spellings of a name, a customer entered from two jobs. The Customers page can cluster them for you.

## Show similar

On **Customers**, click {{button:outline|Show similar (N)}}. It sits top right, next to Show archived. The list switches to showing **only likely duplicates**, grouped. An amber tag tops each group and explains the evidence:

:::example A duplicate group
**Possible duplicates (2) — matching name + address**

**John Ingram** · 1603 Sycamore Street Bandera, TX 78003
**John Ingram** · 1603 Sycamore Street Bandera, TX 78003
:::

Two customers land in a group when they share **any** of: name, address, phone, or email. The comparison is loose. Capitalization, punctuation, and phone formatting don't matter. *"(210) 889-1297"* matches *"+1 210 889 1297"*. Matching is exact after that cleanup, so every group is explainable. There are no fuzzy guesses. Groups chain. If A and B share a phone and B and C share an address, all three show together.

## Merging a group

Click a customer's name in the group to open Edit. Expand **Merge with another customer**, pick the other one, and merge. Their jobs, bids, estimates, and projects all move to the survivor. Repeat until the group is one customer. Then click {{button:outline|Show all}} to leave the view.

A pair in the list isn't necessarily a mistake. Two customers can legitimately share an address, like a landlord and a tenant. They can share a phone, like spouses. The tag tells you the evidence. You make the call.
