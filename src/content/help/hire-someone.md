---
title: hire someone
category: Office
roles: dev, master_technician, assistant, controller
keywords: hire, new hire, onboard, invite, roster, pay setup, salaried, workday, packet, paperwork, start date, add person, attach a login, delete a person, made by mistake, back to desk
order: 19
---
You hire a new person with one form. It makes their invite, roster row, pay and workday in order and shows you each result.

A new person used to be four separate jobs on four screens. The invite on Manage accounts. The roster row on People. The wage on People pay config. The workday on Your account. **Hire** is one form that does them in order and shows you each result.

## Open it

Go to People → Users → {{button:blue|+ Hire}}. Anyone who can add to the roster can open it. Sending the invite is a dev's step, because the invite makes their login. So a non-dev's hire is a roster row and a pay row. A dev sends the invite from their desk later.

An empty group on Users offers **+ Hire** too, and so does an empty People → Subs. That press opens the form with the group's **Kind** already picked.

## Fill it in

- **Name**: the name they will be called everywhere. Pay is keyed by this name. So a second person with the exact same name is refused. Use a distinguishing form.
- **Kind**: Helper, Subcontractor, Assistant, Leader and so on. It decides the login's role.
- **Email** and **Send the invite**: with an invite, the login is created. The emailed link lets them set a password. **Start in training mode** keeps every write blocked until you switch it off. Without the invite, the person is on the roster with no login. The form then offers **Attach a login** at the end.
- **How they sign in**: a dev picks **Email them a link** or **Set a password now**. With a password, no email goes out. You type it twice and hand it over yourself.
- **Starts**: the employment start date, written on the roster row.
- **Pay**: the hourly wage, always. Tick **Salaried** for a flat 8-hour weekday day priced at that wage. Then pick the workday's start time. A pay row with no wage cannot be saved. That is exactly how a test account once put 40 phantom hours a week into every payroll total.
- **Paperwork packet**: optional. The documents appear as unsent. You send each one from Contracts.

## Someone who worked here before

The form checks the name and the email against everyone who left. A match stops the form with an amber line. It names the person and the day they left. Press {{button:blue|Bring back Corinne}} to open their desk with the Bring back window up. Their hours, logbook and HR file stay on that account. Press {{button:outline|This is someone else}} when it is a different person. A new person still needs a name nobody archived holds. Pay is keyed by name. See *bring back a teammate who left*.

## What happens, in order

:::example The steps
1. Invite — the login and the roster row, linked from birth · 2. Pay — the pay row · 3. Workday — the salaried template, and today's sessions on the clock strip · 4. Paperwork — the packet assigned
:::

Each step is its own write. One that fails stops the run with the reason on its line. A {{button:outline|Retry}} picks up there without redoing the earlier steps. When every step is green, {{button:blue|Open their desk}} takes you to the person. The office rate, vehicle hand-off and housing live there. The form closes first, so only the desk is open.

## When the hire made no login

A dev who hired without the invite sees {{button:blue|Attach a login}} at the end of the form. Press it. The form closes and the person's desk opens on **Access & account** with the Attach form ready. Check the email and press {{button:blue|Attach and send the sign-in email}}. The login lands on the same person. Their hours and pay stay where they are. Do not look for an invite for them. An invite would make a second person, so the app refuses it.

## Find the desk again

Closed the desk? People → Users shows {{button:outline|Back to Ana's desk}} in the toolbar until you open it again. Tapping the person's name opens the desk too.

## Made a mistake

Typed the name wrong? Open their desk. On the **Status** row press {{button:outline|Delete…}}. The same press sits in the row's **⋯** menu on People → Users. Delete is for a person made by mistake. It works while nothing points at them yet. The confirm names what goes with them, like the pay row the form wrote. Press {{button:red|Delete Ana}} and the row and the roster record are gone for good. Someone with hours, pay, paperwork or customers cannot be deleted. The window names what they have and offers {{button:red|Archive instead}}. A dev, the controller or a pay-approved leader may delete. Those are the same people who may archive.

## Related

- *open a person's desk*: everything about one person. That includes Start employment for someone already on the roster.
- *archive and restore user accounts*: the other end. End employment on their desk.
