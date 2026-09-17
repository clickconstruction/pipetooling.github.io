---
title: email reports to owners and managers
category: Office
roles: dev, master_technician, assistant, controller
keywords: email reports, report recipients, digests, every report, one modal, send reports, report email, subscribe reports, forward reports, owner reports, report notifications, send now, team lead, team reports, every report
order: 61
---
You can have reports emailed to specific people — every report, or only reports written by certain crew or by a team lead's whole team. Recipients can be someone in the app or any outside email address (an owner's inbox, a GC, a builder).

## Open report email settings

Two doors open the same **Email reports** window (only dev, leader, assistant, and controller roles see either). It has two tabs — {{chip:blue|Digests}} *a bundle on a schedule* and {{chip:blue|Every report}} *one email per report, as filed* — and this guide is about the second:

- **Jobs → Reports**: click {{button:outline|Email reports}} (on a phone it's the **Email reports** link) and pick the **Every report** tab.
- **Dashboard → Recent Reports** card: the mail button {{icon:help}} in the top-right of the card's header opens the window already on **Every report**.

## Add a recipient

1. Click {{button:outline|+ Add recipient}}.
2. Choose **App user** (pick a person from the list) or **External email** (type any address, plus an optional label like "Owner").
3. Under **Which reports**, pick one:
   - **All reports** — they get every report anyone files.
   - **Only from selected people or teams** — pick **People** (named crew) and/or **Team leads**. A team lead means everyone that person leads, plus the lead's own reports — and it stays current: when someone joins or leaves the team on **People → Users → Team leads**, the emails follow without editing this window.
4. Leave **Auto-send new reports** checked so reports email out the moment they're filed. Uncheck it to make this recipient send-only-on-demand.
5. Click {{button:blue|Save}}.

:::example Example
Add the owner's email, choose **Only from selected people or teams**, and pick Darren and Paige — the owner now gets an email every time Darren or Paige files a report, and nobody else's.
:::

:::example A whole team
Add Todd's manager as an app user, choose **Only from selected people or teams**, and pick Todd under **Team leads** — every report filed by Todd or anyone Todd leads lands in the manager's inbox, including a new hire added to Todd's team next month.
:::

## Send recent reports now

Already-filed reports can be pushed out on demand.

1. Save the recipient first.
2. Click {{button:outline|Send now}} on that recipient's card.
3. It emails every matching report from the last 14 days that hasn't already been sent to them, then tells you how many went out.

Reports are never sent twice to the same recipient — auto-send and **Send now** share the same record of what's already gone out.

## Turn a recipient off or remove it

- Uncheck **Enabled** and click {{button:blue|Save}} to pause emails without losing the setup.
- Click {{button:outline|Remove}} to delete the recipient entirely.

## Good to know

- Signature fields in a report show as **[signature captured]** in the email — the signature image itself isn't attached.
- Report emails are separate from the in-app push notifications people already get; turning one on doesn't change the other.
- A recipient who is an app user sees this on their own {{icon:gear}} **Settings → Your account → My email schedule** as the **Field reports** row — "reports from Darren and Paige, and everyone Todd leads" (also when you typed their address instead of picking them). Devs see every recipient on **Settings → Email streams** under **Field report emails**.
- The **Team leads** list is empty until someone leads at least one person on **People → Users → Team leads**.
