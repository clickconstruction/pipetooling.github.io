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
- A **dot** — green means nothing needs you; amber means something does (a document unsent or expiring, no roster row); red means expired paperwork. Hours waiting never color the dot — they are a queue, not an alarm. Hover it for the reasons.
- Their **name** — tap it to open their desk.
- {{chip:gray|login}} or {{chip:gray|no login}} — whether they have an app account. A person with no login still has everything else: a portal (subs), paperwork, pay, a truck.
- Contact, then the **status column**. On a wide screen it is three small cells under a **Hours · Paper · Acct** header: a clock with how many sessions wait for approval, a document with how many paperwork items need you (unsent, expiring, expired, or unsigned — the cell goes red when something has expired), and a person for the account (no roster row, no login, no push, portal on). Hover a cell for the words. Tap the clock to open **Hours approvals** pinned to that person, ready to approve; tap the document or the person to open their desk at that section. Empty cells stay faint so the columns line up.
- On a phone the same facts fold into two controls: the clock counter, and a {{chip:yellow|Needs you · 2}} pill (or **Clear**). Tap the pill and the row unfolds one line per item with a button that opens the right desk section: {{button:blue|Send ›}}, {{button:blue|Create roster row ›}}, {{button:outline|How to enable ›}}.
- The **⋯** menu — Open desk, Edit, Invite as user, Link account, Combine, Archive, depending on the row.

Groups are still by kind. Each header says how many have a login ("Subcontractors 16 · 2 with a login"). Long groups fold the roster-only rows behind **+ N more without a login**; searching or the **No login** filter opens every fold.

## Add someone

Tap {{button:blue|+ Add to roster}} in the toolbar (or **Add** on a group). Pick what they are, type the name, and add an email and phone if you have them. That makes a roster row with **no login**, which is enough for the portal, paperwork, sub sheets and pay. Two boxes on the same dialog do the usual next steps:

- **Also invite them to sign in** — sends the invite email (needs an email). The link in that email opens a **Welcome to ClickTooling** page where they choose a password once. If they come back to that page later while already signed in, it says **You're already set up** with a {{button:blue|Sign in}} button (and *Not you? Sign out*) — it never asks for a new password, so nobody can reset an account by re-opening the link. There is no self-service sign-up page; everyone joins through this invite or through **Accounts · dev** → Manually add user.
- **Open their desk after saving** — lands you on their desk, which for a sub is where the portal globe and {{button:blue|Copy link}} are.

:::example A new external sub
Add to roster → **Subcontractor** → name and phone → leave *invite* unticked → Add. Their desk opens; tap the globe on the Portal row, copy the link, text it. Assign the Subs packet on the Paperwork row. Done — no account was ever needed.
:::

## Find people fast

The search box stays put while you scroll. The chips under it narrow the list: **Everyone**, **No login**, **Needs attention** (paperwork or account gaps — hours never count here), **Hours to approve** (anyone with clock sessions waiting), **Field** (subs, helpers, superintendents), **Office**. The toolbar also holds **Team leads** (who approves whose hours), **Accounts · dev** (roles, passwords, sign-in emails), and **Archived**.
