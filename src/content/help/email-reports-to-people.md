---
title: email reports to owners and managers
category: Office
roles: dev, master_technician, assistant, controller
keywords: email reports, report recipients, digests, every report, one modal, send reports, report email, subscribe reports, forward reports, owner reports, report notifications, send now, every report
order: 61
---
You can have reports emailed to specific people. That can be every report, or only reports written by certain crew.

Recipients can be someone in the app or any outside email address. That could be an owner's inbox, a GC or a builder. GC means the general contractor.

## Open report email settings

Two doors open the same **Email reports** window. Only dev, leader, assistant and controller roles see either:

- **Jobs → Reports**: click {{button:outline|Email reports}}. On a phone it's the **Email reports** link.
- **Dashboard → Recent Reports** card: the mail button {{icon:help}} in the top-right of the card's header.

The window is **one list, by person**. There is one row for everyone who gets report email. A {{chip:blue|Digest}} chip shows each scheduled digest they are on. A digest is a bundle of reports sent on a schedule. The chip carries their own slice: which jobs, and costs or not. An {{chip:gray|Every report}} chip says whose reports they get the moment they are filed. An outside address shows a dash under Digest. Digests go to app users only. Click {{button:outline|Edit}} on a row to change either. Click {{button:outline|+ Add person}} to start one.

## Add a person

1. Click {{button:outline|+ Add person}}.
2. Choose **App user** or **Outside address**. App user picks a person from the list. Outside address takes any address, plus an optional label like "Owner".
3. **Digests** are for app users only. Tick each schedule they should be on. Set their slice on that line. The slice is which jobs and **costs**. Which jobs means yesterday, today, this week or last week. Costs adds an hours × wage column.
4. Tick **Every report** to send them each report as it is filed. Then under **Which reports** pick one:
   - **All reports** means they get every report anyone files.
   - **Only from selected people** lets you pick named crew under **People**.
5. Leave **Auto-send new reports** checked so reports email out the moment they're filed. Uncheck it to make this person send-only-on-demand.
6. Click {{button:blue|Save}}. Saving one person never touches anyone else's rows.

:::example Example
Add the owner's address, tick **Every report**, choose **Only from selected people**, and pick Darren and Paige — the owner now gets an email every time Darren or Paige files a report, and nobody else's.
:::

## Schedules

The **Schedules:** line under the list names each digest schedule with its days and time, like *Yesterday recap Tue–Sat 3:00 AM*. Click a name to change its name, days, time or whether it is on. You can also delete it there. Click **New…** to make one. It starts with nobody on it. Add people from their rows. **Preview or send a test** below it renders a digest as it would go out. Or it sends one to your own login email only.

## Send recent reports now

Already-filed reports can be pushed out on demand.

1. Open the person with {{button:outline|Edit}}. They need a saved **Every report** setting.
2. Click {{button:outline|Send now}}.
3. It emails every matching report from the last 14 days that hasn't already been sent to them. Then it tells you how many went out.

Reports are never sent twice to the same person. Auto-send and **Send now** share the same record of what's already gone out.

## Turn a person off or remove them

- Open the row and uncheck **Enabled** under Every report, or untick a digest. Click {{button:blue|Save}} to pause without losing the setup.
- Click {{button:outline|Remove}} to take the person off every report email at once.

## Good to know

- Signature fields in a report show as **[signature captured]** in the email. The signature image itself isn't attached.
- Report emails are separate from the in-app push notifications people already get. Turning one on doesn't change the other.
- A recipient who is an app user sees this on their own settings. It is the **Field reports** row on {{icon:gear}} **Settings → Your account → My email schedule**. It reads like "reports from Darren and Paige". That is also so when you typed their address instead of picking them. Devs see every recipient on **Settings → Email streams** under **Field report emails**.
