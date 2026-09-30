---
title: add someone to the roster
category: Office
roles: dev, master_technician, assistant, controller
keywords: add person, roster, no login, external sub, external helper, invite as user, users tab, login chip, no login chip, needs attention, filter, add to roster
order: 19
---
People → **Users** lists everyone the company works with. That means the ones who sign in to the app and the ones who do not.

The two used to sit in different groups. Now they share one row shape, and a chip says which is which.

## Read a row

Every row reads the same way, left to right:

- **Imitate** is for devs only. The face-in-brackets icon signs you in as them in one click, the same as always.
- A **dot**. Green means nothing needs you. Amber means something does: a contract never sent, a document expiring, or no roster row. Red means expired paperwork. Hours waiting never color the dot. They are a queue, not an alarm. Hover it for the reasons.
- Their **name**. Tap it to open their desk.
- {{chip:gray|login}} or {{chip:gray|no login}} says whether they have an app account. A person with no login still has everything else: a portal for subs, paperwork, pay, a truck. A sub is a subcontractor.
- Contact, then the **status column**. On a wide screen it is three small cells under a ***Hours · Paper · Acct*** header. The clock shows how many sessions wait for approval. The document shows how many paperwork items need you: unsent, expiring, expired or unsigned. That cell goes red when something has expired. The person is for the account: no roster row, no login, no push, portal on. Hover a cell for the words. Tap the clock to open **Hours approvals** pinned to that person, ready to approve. Tap the document or the person to open their desk at that section. Empty cells stay faint so the columns line up.
- On a phone the same facts fold into two controls. One is the clock counter. The other is a {{chip:yellow|Needs you · 2}} pill or **Clear**. Tap the pill and the row unfolds one line per item. Each line has a button that opens the right desk section. The buttons are {{button:blue|Send ›}}, {{button:blue|Create roster row ›}}, {{button:outline|How to enable ›}}.
- The **⋯** menu holds Open desk, Edit, Invite as user, Link account, Combine and Archive, depending on the row.

Groups are still by kind. Each header says how many have a login, for example *Subcontractors 16 · 2 with a login*. Long groups fold the roster-only rows behind **+ N more without a login**. Searching or the **No login** filter opens every fold.

## Add someone

Tap {{button:blue|+ Add to roster}} in the toolbar, or **Add** on a group. Pick what they are, type the name, and add an email and phone if you have them. That makes a roster row with **no login**. That is enough for the portal, paperwork, sub sheets and pay. Two boxes on the same dialog do the usual next steps:

- **Also invite them to sign in** sends the invite email. It needs an email. The link in that email opens a **Welcome to ClickTooling** page where they choose a password once. Say they come back to that page later while already signed in. Then it says **You're already set up** with a {{button:blue|Sign in}} button and *Not you? Sign out*. It never asks for a new password, so nobody can reset an account by re-opening the link. There is no self-service sign-up page. Everyone joins through this invite or through ***Accounts · dev*** → Manually add user.
- **Open their desk after saving** lands you on their desk. For a sub, that is where the portal globe and {{button:blue|Copy link}} are.

:::example A new external sub
Add to roster → **Subcontractor** → name and phone → leave *invite* unticked → Add. Their desk opens; tap the globe on the Portal row, copy the link, text it. Assign the Subs packet on the Paperwork row. Done — no account was ever needed.
:::

## Find people fast

The search box stays put while you scroll. The chips under it narrow the list: **Everyone**, **No login**, **Needs attention**, **Hours to approve**, **Field** and **Office**. **Needs attention** means paperwork or account gaps. Hours never count there. **Hours to approve** means anyone with clock sessions waiting. **Field** means subs, helpers and superintendents. The toolbar also holds **Team leads**, ***Accounts · dev*** and **Archived**. **Team leads** says who approves whose hours. ***Accounts · dev*** holds roles, passwords and sign-in emails.
