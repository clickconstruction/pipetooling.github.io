---
title: link an external subcontractor to their new account
category: Getting Started
roles: dev, master_technician, assistant
keywords: link account, external subcontractor, duplicate, consolidate, two rows, roster, people
order: 42
---
An **external subcontractor** is a roster entry without a login. When that person later gets a real account, you end up seeing them twice in People → Users — the account row *and* the external row. Linking fixes that: one click ties the roster entry to the account, and only the account row shows from then on.

## Linking the two rows

1. Go to **People → Users** and expand **External Subcontractors** (or the external group under Helpers).
2. On the person's row, click {{button:outline|Link account}}.
3. Pick their account from the list — it only offers accounts with the matching role that aren't already linked to someone else.
4. Click {{button:blue|Link}}.

:::example What happens
The external row disappears from the roster, and the person's pay history, crew records, and sub payments stay attached to them — clock time from the new account now resolves to the same person, so nothing splits or resets.
:::

## Good to know

- **Nothing merges or deletes.** The roster entry lives on behind the scenes as the person's pay identity; the link just tells the app which login belongs to it.
- The account list is filtered by role — an external subcontractor links to a subcontractor account, an external helper to a helpers account.
- Rows also fold together automatically when the external entry's **email matches the account's email** — linking is for when the emails differ or the external entry has none.
- Only devs and the person's creator can link.

## Avoiding the duplicate in the first place

If someone needs an account but won't click an email invite, use **People → Users → Manage accounts → Manual add**: it creates the account immediately with a password you set and hand to them — no email confirmation needed. Then link it to their external entry (or just use the same email, and the rows fold together on their own).
