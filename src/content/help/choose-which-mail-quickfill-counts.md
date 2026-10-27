---
title: choose which mail quickfill counts
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: quickfill, email station, mail the app counts, mail quickfill counts, gmail, labels, inbox, follow up, next actions, work@, bids@, lead, count, privacy, delegation
where: /settings?tab=settings-phone-texts
order: 118
---
Quickfill's Email station reads the mail that sits in Gmail, so nobody has to type the list each morning. The owner chooses which inboxes and labels it counts, and who sees them.

## What the app keeps

The app reads each listed inbox every 15 minutes. It keeps who wrote each thread, its subject and its dates. It never reads the words of an email and never opens a file. It adds no label, archives nothing and marks nothing read.

## Before the first count

The Workspace admin gives the app one more Google permission first. Until then the card says Google refused each inbox.

1. Open admin.google.com as the Workspace admin.
2. Open **Security**, then **Access and data control**, then **API controls**.
3. Press **Manage domain-wide delegation**.
4. Find the app's row, the one that already reads bids@, and press **Edit**.
5. Add `https://www.googleapis.com/auth/gmail.metadata` beside the two Gmail permissions there.
6. Press **Authorize**.

## Choose the inboxes

1. Open [Phone and texts](/settings?tab=settings-phone-texts) in Settings.
2. Find **Mail the app counts**.
3. Type a shared inbox such as work@ and press {{button:outline|Add a shared box}}.
4. Pick a teammate and press {{button:outline|Add a person}} to count their own inbox.
5. Press the {{button:outline|Off}} switch, then press {{button:blue|Turn it on}}.

The first count comes within 15 minutes. Each row then says what it found, such as *Inbox 2 · Follow Up 0*.

## Choose the labels

Each inbox counts Inbox, Follow Up and Next Actions to start. Type other labels in the row's box with a comma between them. Then press {{button:blue|Save}}.

A label the inbox does not have gets its own line, such as *No label named Follow Up*. Make the label in Gmail, or pick another one.

## The limit

A thread that sits longer than the limit shows on the station by name. The limit starts at 3 days. Type another number beside **Past the limit after** and press {{button:blue|Save the limit}}.

## Who sees what

- A shared inbox shows to everyone in the office.
- A person's own inbox shows to that person and to the lead.
- Nobody else sees a person's inbox. The owner sees it only after picking themselves as the lead.

Pick the lead under **Who sees everyone’s rows**. Each person sees their own rows either way.

## Your own inbox

When the owner adds you, a card shows on [Your account](/settings?tab=settings-account). The card names the labels the app counts and who sees them.

- Press × on a label to stop counting it.
- Type a label in the box and press {{button:outline|Add}} to count it too.
- Press the {{button:green|On}} switch to stop counting your inbox.

When you switch it off, the app forgets the threads it kept for you. The owner sees that it is off. A label you take off is forgotten the same way.
