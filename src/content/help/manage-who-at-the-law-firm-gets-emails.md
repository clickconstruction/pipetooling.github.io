---
title: manage who at the law firm gets emails
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: legal, attorney, law firm, portal, emails, notifications, digest, confirm, unsubscribe, pause, recipients
---
The firm decides who at the firm hears from us and how often. The office sees the same rules and keeps two overrides. Two guards nobody can switch off: a new address is inert until its owner clicks a confirmation, and every email carries a one-click stop.

## What the firm sets, on their portal

On the portal's **Notifications** page each person at the firm has one rule:

- **Right away** or **Weekly digest** — and for the digest, which weekday and Central time.
- **Every matter** or **Only my matters** — the matters where they are named as the handling person.
- {{button:outline|Stop emails to this person}} and {{button:outline|Turn emails back on}}.

**Add a person** sends that address one confirmation email and nothing else until they click *Yes, email me*. The handling person on a matter always hears about it right away, whatever their rule says.

## What they hear about

- A new account referred to them (the moment a dev marks it attorney-ready).
- The office answering one of their questions.
- An account pulled back.

Right-away people get one email per event within five minutes. Digest people get one email on their day: every open matter, then everything since their last digest.

## What the office sees and controls

On the Legal desk header, {{button:outline|✉ Firm's emails}} lists every person with their rule and status ({{chip:green|confirmed}} · {{chip:yellow|not confirmed}} · {{chip:gray|stopped}}). Two overrides:

- {{button:outline|Remove}} takes a person off the list.
- {{button:outline|Pause all emails to the firm}} holds every email; events queue and send when you resume. The portal keeps working meanwhile.

The **Mark attorney ready** sheet shows who will hear about that release, by their rules: *Email now*, *In their digest*, *Not confirmed*, *Not emailed*.

:::example Before anyone is on the list
Until the firm adds its people, the handling person's email on Settings → Collections law firm is the only address, and it hears about every release right away.
:::

## Wording

The three emails — account referred (also the office-answered and pulled-back variants), the weekly digest, and the confirmation — are listed in the Outbound email catalog on Settings → Email templates as `legal-notify-dispatch` / `submit-legal-portal` sends; their wording is fixed in this release.
