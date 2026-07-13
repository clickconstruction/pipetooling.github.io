---
title: put a new assistant in read-only training mode
category: Getting Started
roles: dev
keywords: read only, training, trainee, learning, explore, new hire, assistant, active accounts, restrict
order: 42
---
Training mode lets a new assistant explore the whole app without being able to change anything. They see everything their role normally sees — jobs, materials, customers, reports — but every save is blocked until you switch the mode off.

## Turn it on

1. Open the **Active Accounts** panel (Settings → People & accounts, or **Manage accounts** on People → Users).
2. Find the assistant's row. In the **Last login** column, tick the {{chip:yellow|Read-only}} checkbox under their last-login time.

The checkbox only appears on rows with the Assistant role.

:::example What the trainee experiences
They sign in normally and see an amber **Training mode — read-only** banner at the top of every page. Browsing, searching, and opening records all work; anything that would save a change is rejected with an error instead of saving.
:::

## Turn it off

Untick the same checkbox. Their normal write access returns the next time the app checks their session — a page refresh picks it up immediately.

## Good to know

- Nothing about the account changes except the flag — no role change, no data touched.
- The block is enforced by the database, not just hidden buttons, so there is no way around it from the app.
- Save buttons still appear while training; pressing one shows an error rather than saving. That's expected.

## Related

- To take away someone's sign-in entirely, see *archive and restore user accounts*.
