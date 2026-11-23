---
title: find and merge duplicate customers
category: Getting Started
roles: dev, master_technician, assistant, controller, estimator
keywords: duplicate customers, show similar, merge, dedupe, same address, same phone, every reference, portal address, deleted records, legal matter
order: 43
---
Duplicates sneak in: a retried save, two spellings of a name, a customer entered from two jobs. The Customers page can cluster them for you.

## Show similar

On **Customers**, click {{button:outline|Show similar (N)}}. It sits top right, next to Show archived. The list switches to showing **only likely duplicates**, grouped. An amber tag tops each group and explains the evidence:

:::example A duplicate group
**Possible duplicates (2) — matching name + address**

**John Inglow** · 5403 Sorrel Street Bandera, TX 78003
**John Inglow** · 5403 Sorrel Street Bandera, TX 78003
:::

Two customers land in a group when they share **any** of: name, address, phone, or email. The comparison is loose. Capitalization, punctuation, and phone formatting don't matter. *"(210) 555-0145"* matches *"+1 210 555 0145"*. Matching is exact after that cleanup, so every group is explainable. There are no fuzzy guesses. Groups chain. If A and B share a phone and B and C share an address, all three show together.

## Merging a group

Click a customer's name in the group to open Edit. Expand **Merge with another customer** and pick the other one. Before anything moves, the window lists what the other customer holds.

Everything linked to the other customer moves to the one you keep. The other customer's jobs, bids, estimates, projects, properties, files, ratings, portal links, payment notes and legal matters all move. Every other record that names the customer moves too.

Some things a customer can hold only once. The window says what happens to each under **Where only one can stand**.

- The customer you keep keeps its own portal address. The other address stops working.
- The customer you keep keeps its own follow-up setting and pay calendar.
- A second live portal link, open proposal room or sent paper is closed and kept.
- If both customers have a statement mark for one week, the newer mark stands.
- If both customers answered one word ask, the newer answer stands.
- A property both customers hold folds into one when nothing on it differs.

Anything a merge drops is kept in the deleted records. A dev can bring it back.

Some jobs name one customer as the customer and the other as the GC. After the merge those jobs name the GC only. Those jobs then bill the GC.

Two customers that each have a legal matter cannot be merged. Ask a dev to join the two matters first.

Click **Merge into this customer…** and type MERGE to finish. Repeat until the group is one customer. Then click {{button:outline|Show all}} to leave the view.

A pair in the list isn't necessarily a mistake. Two customers can legitimately share an address, like a landlord and a tenant. They can share a phone, like spouses. The tag tells you the evidence. You make the call.
