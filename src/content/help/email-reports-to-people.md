---
title: email reports to owners and managers
category: Office
roles: dev, master_technician, assistant, controller
keywords: email reports, report recipients, send reports, report email, subscribe reports, forward reports, owner reports, report notifications, send now
order: 61
---
You can have reports emailed to specific people — every report, or only reports written by certain crew. Recipients can be someone in the app or any outside email address (an owner's inbox, a GC, a builder).

## Open report email settings

1. On the **Dashboard**, find the **Recent Reports** card.
2. Click the mail button {{icon:help}} in the top-right of that card's header. (Only dev, master technician, assistant, and controller roles see it.)
3. The **Report email recipients** window opens.

## Add a recipient

1. Click {{button:outline|+ Add recipient}}.
2. Choose **App user** (pick a person from the list) or **External email** (type any address, plus an optional label like "Owner").
3. Under **Which reports**, pick one:
   - **All reports** — they get every report anyone files.
   - **Only from selected people** — search and pick the crew whose reports they should get.
4. Leave **Auto-send new reports** checked so reports email out the moment they're filed. Uncheck it to make this recipient send-only-on-demand.
5. Click {{button:blue|Save}}.

:::example Example
Add the owner's email, choose **Only from selected people**, and pick Darren and Paige — the owner now gets an email every time Darren or Paige files a report, and nobody else's.
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
