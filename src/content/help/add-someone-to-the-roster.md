---
title: add someone to the roster
category: Office
roles: dev, master_technician, assistant, controller
keywords: add person, roster, no login, external sub, external helper, invite as user, users tab, login chip, no login chip, needs attention, filter, add to roster
order: 19
---
People → **Users** lists everyone the company works with — the ones who sign in to the app and the ones who don't. The two used to sit in different groups; now they share one row shape, and a chip says which is which.

## Read a row

Every row reads the same way, left to right:

- **Imitate** (devs only) — the face-in-brackets icon signs you in as them in one click, the same as always.
- A **dot** — green means nothing needs you; amber means something does (sessions waiting, a document unsent or expiring, no roster row); red means expired paperwork. Hover it for the reasons.
- Their **name** — tap it to open their desk.
- {{chip:gray|login}} or {{chip:gray|no login}} — whether they have an app account. A person with no login still has everything else: a portal (subs), paperwork, pay, a truck.
- Contact, then a few chips that only appear when they mean something: {{chip:yellow|23 waiting}}, {{chip:yellow|1 doc unsent}}, {{chip:red|1 expired}}, {{chip:yellow|no roster row}}, {{chip:blue|portal on}}, {{chip:gray|no push}}.
- The **⋯** menu — Open desk, Edit, Invite as user, Link account, Combine, Archive, depending on the row.

Groups are still by kind. Each header says how many have a login ("Subcontractors 16 · 2 with a login"). Long groups fold the roster-only rows behind **+ N more without a login**; searching or the **No login** filter opens every fold.

## Add someone

Tap {{button:blue|+ Add to roster}} in the toolbar (or **Add** on a group). Pick what they are, type the name, and add an email and phone if you have them. That makes a roster row with **no login**, which is enough for the portal, paperwork, sub sheets and pay. Two boxes on the same dialog do the usual next steps:

- **Also invite them to sign in** — sends the invite email (needs an email).
- **Open their desk after saving** — lands you on their desk, which for a sub is where the portal globe and {{button:blue|Copy link}} are.

:::example A new external sub
Add to roster → **Subcontractor** → name and phone → leave *invite* unticked → Add. Their desk opens; tap the globe on the Portal row, copy the link, text it. Assign the Subs packet on the Paperwork row. Done — no account was ever needed.
:::

## Find people fast

The search box stays put while you scroll. The chips under it narrow the list: **Everyone**, **No login**, **Needs attention**, **Field** (subs, helpers, superintendents), **Office**. The toolbar also holds **Team leads** (who approves whose hours), **Accounts · dev** (roles, passwords, sign-in emails), and **Archived**.
