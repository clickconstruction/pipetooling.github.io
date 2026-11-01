---
title: manage who at the law firm gets emails
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: legal, attorney, law firm, portal, emails, notifications, digest, confirm, unsubscribe, pause, recipients, title, only theirs, handling, sample inbox, not reaching, bounced, retry
---
You open the Legal desk to see who at the law firm gets our emails. The firm sets the rules on its portal, and the office keeps two overrides.

Two guards nobody can switch off. A new address is inert until its owner clicks a confirmation. Every email carries a one-click stop.

## What the firm sets, on their portal

The firm opens the **Notifications** page on its portal. The card **Add a person at the firm** is the row it becomes. The firm types a name, an email and a title. The title is optional, a word like attorney or paralegal. It shows beside the name on the portal and on your Legal desk. It changes nothing else. Each person has one rule, set on the card and changed later on their row:

- **Emails**: **Each event** or **Weekly digest**. Each event sends one email per event. A digest also picks a weekday and a Central time.
- **Matters**: **Every matter** or **Only theirs**. A matter is one account sent to the firm. Only theirs means the matters where the office named that person as handling. A count under the pick says how many open matters name them today. A zero means they would hear nothing yet.
- {{button:outline|Stop emails to this person}} and {{button:outline|Turn emails back on}}.

The press under the card names the person, *Send Ann a confirmation*. It sends that address one confirmation email. Nothing else goes out until they click *Yes, email me*. When that email cannot be sent, the portal says so in red. The firm presses {{button:outline|Resend the confirmation}} a minute later. The handling person on a matter always hears about it. They hear under their own rule, one email per event or in their digest. That holds even when they chose *only my matters*. Nobody hears anything until they are on this list and confirmed. The firm's contact email on the office's Settings page is a contact, not a subscription.

Under the card, a sample week shows what lands in that person's inbox under the rule picked. The accounts in it are made up. Each line is an email's subject. Press a line to read that email under the list, with its stop link. Under **Each event** the fee line is dim and reads *weekly digest only*. A fee the office saw rides the digest alone. Under **Weekly digest** the one line opens the digest, each matter a heading with its week under it.

## What they hear about

- A new account referred to them. The email goes the moment a dev marks it attorney-ready.
- The office answering one of their questions. The email quotes their question too.
- The office asking them something, or asking for a sign-off on one job.
- A note from the office on a matter.
- A payment they received that the office applied to the job.
- An account pulled back, with the office's reason. The firm's email calls it a referral withdrawn.
- A fee or cost they added that the office saw. This one goes in the digest only.

People on **Each event** get one email per event within five minutes. When an email does not go, it is tried again every five minutes for an hour. The others are not sent it twice. Digest people get one email on their day. Each open matter is a heading with its stage, and the week's lines sit under it. The matters with news come first. A quiet matter reads *Nothing new this week*.

## What the office sees and controls

You press {{button:outline|Emails}} beside the firm's name on the Legal desk header. The window that opens lists every person with their rule and status. The status is {{chip:green|confirmed}}, {{chip:yellow|not confirmed}}, {{chip:yellow|not reaching}} or {{chip:gray|stopped}}. *Not reaching* means our emails to that person stopped going through. A red line under the name says since when and what the mail service said. The line clears once an email gets through. The header button counts these people. The firm sees the same line on its portal. The office has two overrides:

- {{button:outline|Remove}} takes a person off the list.
- {{button:outline|Pause all emails to the firm}} holds every email. Events queue and send when you resume. The portal keeps working meanwhile.

The **Mark attorney ready** sheet shows who will hear about that release, by their rules: *Email now*, *In their digest*, *Not confirmed*, *Not emailed*.

:::example Before anyone is on the list
Until the firm adds its people on the portal, nobody is emailed — the matter still appears on their portal, and the Mark attorney ready sheet says so. The contact email on Settings → Jobs & billing → Collections law firm is a contact for the office, not a subscription. Send the firm their link; they take it from there.
:::

## Wording

There are four emails: the firm's link, account referred, the weekly digest, and the confirmation. The office sends the firm's link from {{button:outline|Portal link}} on the Legal desk header. The account-referred email has a variant for each event above. All four are listed in the Outbound email catalog on Settings → Email templates. The wording of all four is fixed.
