---
title: archive and restore user accounts
category: Getting Started
roles: dev
keywords: archive user, restore user, ban, offboard, active accounts, deactivate
order: 41
---
Archiving is how you offboard someone's login. It never deletes anything — their jobs, clock time, reports, and history stay attached to the account — it just bans the sign-in and hides them from active lists and pickers.

## How to archive

Everything happens in one dialog in the **Active Accounts** panel (Settings → People & teams, or **Manage accounts** on People → Users). In the Manage accounts modal, use the search bar at the top to jump straight to the account — it matches name, email, or role and filters the archived list too. Two ways in, same dialog:

1. **From the top** — click {{button:red|Archive user}} and pick the account from the dropdown.
2. **From a row** — click {{button:outline|Edit}} on the account, then the red {{button:red|Archive}} button at the end of the actions; the dialog opens with that account already selected.

The confirmation explains exactly what will happen before you commit. If the account owns customers, the same dialog asks what should happen to them:

- **Keep them assigned to the archived account** (the default), or
- **Reassign them to another master** — pick who inherits them, and the button becomes {{button:red|Reassign & archive}} so both happen in one step.

:::example What archiving does
Sign-in banned · hidden from active lists and assignment pickers · taken off open roadmap tasks · nothing deleted · restorable anytime
:::

**Roadmap tasks**: archiving also takes the person off every *open* roadmap task, so that work drops into the Plan view's **Needs a person** lane instead of sitting assigned to someone who's gone. Completed tasks keep their name — history stays credited.

## Restore

Open the **Archived users** section at the bottom of the panel and click **Restore** — the account is un-archived and can sign in again.

Restoring also puts them back on their old roadmap tasks — but only the ones that are still open and that nobody else has picked up in the meantime. A task with a new person keeps its new person.

## Related

- The roster **Archive** button on People → Users hides a roster *person* — that's separate from their login account.
- To fold a duplicate account into another, see *merge two user accounts into one*.
