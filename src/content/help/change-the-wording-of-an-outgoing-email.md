---
title: change the wording of an email the app sends
category: Office
roles: dev
keywords: email, wording, template, subject, body, catalog, digest, preview, test send, variables
---
Every email the app sends is listed in one place, and most of their wording can be changed right from Settings — no deploy, takes effect on the next send.

## Find the email

1. Open **Settings → Email templates & testing** and expand **Email Templates**.
2. The **Outbound email catalog** at the top lists every email the app can send — who receives it, what it attaches, and whether its wording is editable yet. Emails marked {{chip:green|editable}} have a template card further down the page; {{chip:gray|hardcoded}} ones become editable as their senders adopt the template engine.
3. Send counts on catalog rows show how often each email actually went out in the last 30 days.

## Edit the wording

1. Scroll to the matching template card and press {{button:outline|Edit}}.
2. Change the subject or body. Variables like `{{project}}` or `{{amount}}` are filled in at send time — the card's hint row lists which ones that email supports. A typo'd variable stays visible in the sent email instead of silently vanishing, so mistakes show themselves.
3. Press {{button:blue|Save template}}. No template saved means the built-in wording sends — and **Reset** brings the built-in wording back any time.

:::example Digest emails edit less, on purpose
For digest emails (money waiting, crew day, weekly movement, and friends) you edit the **subject and the intro paragraph above the data** — the data tables themselves are built from live jobs at send time and never change here. `{{default_subject}}` inserts the built-in subject line, dates and job labels included.
:::

## Check it before it sends

- {{button:outline|Open as email ↗}} opens a new tab showing your current wording — even unsaved — as the email itself, with sample data filled into the variables. Digest previews mark their data table as sample data.
- {{button:outline|Test Email}} sends the real thing to the test target picked at the top of the page — the byte-for-byte check.

Wording only: the attached documents (invoices, signed releases, fee notices) are never edited here — they stay exactly what the app generated.
