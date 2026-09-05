---
title: get notified when a bid or estimate is signed
category: Settings
roles: dev, master_technician, assistant, controller
keywords: signed agreements, signature, notify, email, auto create job, create job, accepted estimate, bid room signed, recipients
order: 96
---
Every signature — a customer accepting an estimate, a GC signing a bid-room proposal — sends one email to the **Signed agreements** list, and can create the job for you.

## Who gets the email

**Settings → Emails & reports → Signed agreements.** With no one picked, the email goes to every active assistant, master, controller and dev — that is the default, and new people in those roles are covered automatically. Add or remove people on the card to make an explicit list instead. People picked on a single estimate (the estimate's **Estimate accepted emails**) are added on top. Masters always receive, whichever master owns the record; assistants, controllers and devs receive for their own master's records.

:::example What the email says
**Mark Knight signed the proposal for Hunter Road Sound Studio** · Knight Contracting · 2530 Hunter Rd · Sept 4, 2026 · 9:12 AM — **To Plans · $56,343.00** — {{button:blue|Open the signed record}} {{button:amber|Create the job}}
:::

## Creating the job

- **One click.** {{button:amber|Create the job}} in the email opens the signed record with the Create-job window already up — name, address, customer and the accepted lines filled in. Press Create and the job is linked to the record and the bid.
- **Automatically.** On the same Settings card, switch on **Create jobs automatically** for estimates, for bid-room proposals, or both. The job is then created the moment they sign, with the next job number and the accepted lines as Specific Work, and the email reads {{button:green|Open job J1234}} instead. If a job already exists for that bid, it is linked rather than duplicated. The new job's activity shows *Job opened automatically from signed estimate #N*.

Two rules keep automatic creation from making a mess:

- **It will not duplicate a job you already typed.** If the same customer already has a job with the same name and the same value (within 1% or $1) opened in the last 90 days, the app leaves it alone and the email offers {{button:amber|Create the job}} — use **Link existing job** in that window to attach the signed record to the job you made.
- **A change order never becomes a job.** A signed change order belongs on the job it changes. If it is already on one, the email points to that job; if not, {{button:amber|Create the job}} opens the **Apply change order** window, where you pick the job and confirm the change to its total. The app never applies a change order on its own.

Either way, **Jobs → Stages** shows {{chip:green|Signed · Bid room proposal}} (or the estimate's signature) on the job's contract chip, and the Bid Board shows the {{chip:green|J1234}} chip.

## Seeing what went out

**Settings → Email templates & testing → Outbound email catalog** lists the email as *Signed agreement — staff notice* with a {{button:blue|Preview}}; **Most recent emails sent** links each "Signed — …" line back to the card.
