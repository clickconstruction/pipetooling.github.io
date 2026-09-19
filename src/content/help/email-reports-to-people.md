---
title: email reports to owners and managers
category: Office
roles: dev, master_technician, assistant, controller
keywords: email reports, report recipients, digests, every report, one modal, send reports, report email, subscribe reports, forward reports, owner reports, report notifications, send now, team lead, team reports, every report
order: 61
---
You can have reports emailed to specific people — every report, or only reports written by certain crew or by a team lead's whole team. Recipients can be someone in the app or any outside email address (an owner's inbox, a GC, a builder).

## Open report email settings

Two doors open the same **Email reports** window (only dev, leader, assistant, and controller roles see either):

- **Jobs → Reports**: click {{button:outline|Email reports}} (on a phone it's the **Email reports** link).
- **Dashboard → Recent Reports** card: the mail button {{icon:help}} in the top-right of the card's header.

The window is **one list, by person**: one row for everyone who gets report email, with a {{chip:blue|Digest}} chip for each scheduled digest they are on (their own slice — which jobs, all users or their team, costs or not) and an {{chip:gray|Every report}} chip saying whose reports they get the moment they are filed. An outside address shows a dash under Digest — digests go to app users only. Click {{button:outline|Edit}} on a row to change either, or {{button:outline|+ Add person}} to start one.

## Add a person

1. Click {{button:outline|+ Add person}}.
2. Choose **App user** (pick a person from the list) or **Outside address** (type any address, plus an optional label like "Owner").
3. **Digests** (app users only): tick each schedule they should be on, and set their slice on that line — which jobs (yesterday, today, this week, last week), **All users** or **My team** (the people they lead), and **costs** to add an hours × wage column.
4. Tick **Every report** to send them each report as it is filed, then under **Which reports** pick one:
   - **All reports** — they get every report anyone files.
   - **Only from selected people or teams** — pick **People** (named crew) and/or **Team leads**. A team lead means everyone that person leads, plus the lead's own reports — and it stays current: when someone joins or leaves the team on **People → Users → Team leads**, the emails follow without editing this window.
5. Leave **Auto-send new reports** checked so reports email out the moment they're filed. Uncheck it to make this person send-only-on-demand.
6. Click {{button:blue|Save}}. Saving one person never touches anyone else's rows.

:::example Example
Add the owner's address, tick **Every report**, choose **Only from selected people or teams**, and pick Darren and Paige — the owner now gets an email every time Darren or Paige files a report, and nobody else's.
:::

:::example A whole team
Add Todd's manager as an app user, tick **Yesterday recap** with **My team**, tick **Every report**, choose **Only from selected people or teams**, and pick Todd under **Team leads** — the manager gets a morning digest of their own crew and every report filed by Todd or anyone Todd leads, including a new hire added to Todd's team next month.
:::

## Schedules

The **Schedules:** line under the list names each digest schedule with its days and time (*Yesterday recap Tue–Sat 3:00 AM*). Click a name to change its name, days, time or whether it is on, or to delete it; click **New…** to make one (it starts with nobody on it — add people from their rows). **Preview or send a test** below it renders a digest as it would go out, or sends one to your own login email only.

## Send recent reports now

Already-filed reports can be pushed out on demand.

1. Open the person with {{button:outline|Edit}} — they need a saved **Every report** setting.
2. Click {{button:outline|Send now}}.
3. It emails every matching report from the last 14 days that hasn't already been sent to them, then tells you how many went out.

Reports are never sent twice to the same person — auto-send and **Send now** share the same record of what's already gone out.

## Turn a person off or remove them

- Open the row, uncheck **Enabled** under Every report (or untick a digest) and click {{button:blue|Save}} to pause without losing the setup.
- Click {{button:outline|Remove}} to take the person off every report email at once.

## Good to know

- Signature fields in a report show as **[signature captured]** in the email — the signature image itself isn't attached.
- Report emails are separate from the in-app push notifications people already get; turning one on doesn't change the other.
- A recipient who is an app user sees this on their own {{icon:gear}} **Settings → Your account → My email schedule** as the **Field reports** row — "reports from Darren and Paige, and everyone Todd leads" (also when you typed their address instead of picking them). Devs see every recipient on **Settings → Email streams** under **Field report emails**.
- The **Team leads** list is empty until someone leads at least one person on **People → Users → Team leads**.
