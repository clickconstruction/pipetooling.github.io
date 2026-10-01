---
title: link an external subcontractor to their new account
category: Getting Started
roles: dev, master_technician, assistant
keywords: link account, external subcontractor, duplicate, consolidate, two rows, roster, people
order: 42
---
A roster row with no login shows twice once the person gets a real account. Linking ties the roster row to the account, so only the account row shows from then on.

The roster row without a login shows a {{chip:gray|no login}} chip on People → Users. When that person later gets a real account, you see them twice. You see the account row and the roster row. One click ties the roster row to the account.

## Linking the two rows

1. Go to **People → Users**. Tap the **No login** filter, or find their row. Long groups fold behind *+ N more without a login*. Open the row's **⋯** menu.
2. On the person's row, click {{button:outline|Link account}}.
3. Pick their account from the list. It only offers accounts with the matching role that are not already linked to someone else.
4. Click {{button:blue|Link}}.

:::example What happens
The external row disappears from the roster, and the person's pay history, crew records, and sub payments stay attached to them — clock time from the new account now resolves to the same person, so nothing splits or resets.
:::

## Good to know

- **Nothing merges or deletes.** The roster entry lives on behind the scenes as the person's pay identity. The link just tells the app which login belongs to it.
- The account list is filtered by role. An external subcontractor links to a subcontractor account. An external helper links to a helpers account.
- Rows also fold together automatically when the external entry's **email matches the account's email**. Linking is for when the emails differ or the external entry has none.
- Only devs and the person's creator can link.

## Avoiding the duplicate in the first place

Someone may need an account but will not click an email invite. Use **Manage accounts… → Manual add**. You find it under Settings → People & teams, or on their desk under Access & account. It creates the account immediately with a password you set and hand to them. No email confirmation is needed. Then link it to their roster row. Or just use the same email, and the rows fold together on their own.
