---
title: get notified when a bid or estimate is signed
category: Office
roles: dev, master_technician, assistant, controller
keywords: signed agreements, signature, notify, email, auto create job, create job, accepted estimate, bid room signed, recipients
order: 96
---
Every signature sends one email to the Signed agreements list. It can also create the job for you.

A signature is a customer accepting an estimate, or a GC signing a bid-room proposal. GC means the general contractor.

## Who gets the email

Open **Settings → Emails & reports → Signed agreements.** With no one picked, the email goes to every active assistant, leader, controller and dev. That is the default. New people in those roles are covered automatically. Add or remove people on the card to make an explicit list instead. People picked on a single estimate are added on top. That is the estimate's **Estimate accepted emails** field. Leaders always receive, whichever leader owns the record. Assistants, controllers and devs receive for their own leader's records.

:::example What the email says
Subject: **Knight Contracting signed $56,343 · Hunter Road Sound Studio** (an estimate reads **Dana Ruiz signed $4,250 · Second-floor rough-in**, or just **Dana Ruiz signed $4,250**, with the work added only when the estimate's title names it); the inbox preview line says whether the job exists yet.

**Mark Knight signed the proposal for Hunter Road Sound Studio** · Knight Contracting · 2530 Hunter Rd · Sept 4, 2026 · 9:12 AM — **To Plans · $56,343.00** — {{button:blue|Open the signed record}} {{button:amber|Create the job}}
:::

## Creating the job

- **One click.** {{button:amber|Create the job}} in the email opens the signed record with the Create-job window already up. The name, address, customer and the accepted lines are filled in. Press Create. The job is linked to the record and the bid.
- **Automatically.** On the same Settings card, switch on **Create jobs automatically** for estimates, for bid-room proposals, or both. The job is then created the moment they sign. It gets the next job number and the accepted lines as Specific Work. The email then reads {{button:green|Open job J1234}} instead. If a job already exists for that bid, it is linked rather than duplicated. The new job's activity shows *Job opened automatically from signed estimate #N*.

Two rules keep automatic creation from making a mess:

- **It will not duplicate a job you already typed.** The app checks for a job of the same customer with the same name and the same value. Same value means within 1% or $1. It looks at jobs opened in the last 90 days. If it finds one, the app leaves it alone. The email then offers {{button:amber|Create the job}}. Use **Link existing job** in that window to attach the signed record to the job you made.
- **A change order never becomes a job.** A change order is a signed change to a job's work or price. A signed change order belongs on the job it changes. If it is already on one, the email points to that job. If not, {{button:amber|Create the job}} opens the **Apply change order** window. There you pick the job and confirm the change to its total. The app never applies a change order on its own.

Either way, **Jobs → Stages** shows {{chip:green|Signed · Bid room proposal}} on the job's contract chip. For an estimate it shows the estimate's signature instead. The Bid Board shows the {{chip:green|J1234}} chip.

## Seeing what went out

**Settings → Email templates & testing → Outbound email catalog** lists the email as *Signed agreement — staff notice* with a {{button:blue|Preview}}. **Most recent emails sent** links each "… signed $…" line back to the card.
