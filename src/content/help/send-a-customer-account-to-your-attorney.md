---
title: send a customer account to your attorney
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: legal, attorney, law firm, collections, attorney ready, release, portal, link, needs you, pull back, write down, settled, fees, contingency, sworn account, lien
---
When a customer will not pay, one law firm does the pursuing and Click hands them everything on the account. This is the whole path, start to finish: moving a job to Collections, the review, the release, what the firm does, and how it ends. The three guides it links to go deeper on each surface.

## 1. Move the job to Collections

On **Jobs → Pipeline → Billed Awaiting Payment**, open the row's menu and choose {{chip:yellow|Flag for collections}} (call mode has the same door as **Move to Collections…**). The confirm asks for a note on why the office thinks this one will not pay on its own — the attorney reads that note first. Any office role can do this. The job moves to the **Collections** section at the bottom of the Pipeline and keeps its balance.

Nothing reaches an attorney yet. Collections is the office's holding pen; the firm only ever sees what a dev releases.

## 2. A dev gets a card

Every Collections account that has not been reviewed shows on the dev's Dashboard as **"N Collections accounts await your review before an attorney sees them"**, oldest first. Its button opens the Legal desk on that account. Office staff who want a dev's eyes sooner press {{button:outline|Ask a dev to review…}} on the desk with a short note; that account goes to the top of the card.

## 3. Review the account the way the firm will see it

On **Jobs → Pipeline**, the **Collections** header carries {{button:outline|⚖ Legal}}, next to the count, where Billed has Accounts Receivable. It opens the desk on every Collections account, the ones worth the most first.

An account is the **payer** — the GC when one pays, otherwise the customer — and it spans every Collections job that payer owes on. For each account the desk says, at the top:

- **Theory** — what an attorney could plead: {{chip:green|Signed contract}}, {{chip:yellow|Sworn account}}, {{chip:yellow|Lien only}} or {{chip:red|None yet}}.
- **Click keeps** — the balance less the firm's contingency and a filing cost, with a verdict: worth it · marginal · not worth it.
- **Before this goes to an attorney** — {{chip:red|fix}} items an attorney asks for first and {{chip:yellow|note}} items worth knowing, each with a button to the surface that owns the record.

Then five tabs — **Account · Paper · Their word · Evidence · Fees & steps** — built from the same records the firm's portal is built from. Fix what the gap list says, tick or untick what the firm may read on **Their word**, and come back. Details: [review a collections account before it goes to your attorney](/help/review-a-collections-account-before-it-goes-to-your-attorney).

:::example Not every account should go
Surf Thru Express Car Wash owes $250 on one job with no agreement and no field evidence. The desk reads {{chip:red|None yet}} and **Click keeps −$182 · not worth it** — the firm's third and a filing cost eat more than the balance. {{button:outline|Write down…}} is the honest exit for that one; the firm never needs to see it.
:::

## 4. Set the firm up once

**Settings → Jobs & billing → Collections law firm** (dev) holds the firm's name, the handling person, a contact email and phone, and the fee model — contingency % and filing cost — behind "Click keeps". Below it, **Click's particulars for filing** (legal entity, license, registered agent, custodian of records, affiant, office phone and email, W-9 note) show on the firm's portal so a petition or lien affidavit needs nothing from you. One firm at a time.

The contact email is a contact, not a subscription: the firm's own people decide who gets emails, on their portal.

## 5. Mark it attorney-ready — that is the release

Only a dev sees {{button:blue|⚖ Mark attorney ready…}}. The sheet says exactly what goes — jobs, balance, theory, exhibits, how many entries are held back — names the handling person at the firm, lists who at the firm will hear and how ({{chip:green|Email now}} · {{chip:gray|In their digest}} · {{chip:yellow|Not confirmed}}), and takes a note for the firm. It warns when red gaps are still open; you can mark anyway and the packet's cover sheet says so.

Confirm and the account moves to **With the firm** on the desk's rail, the Pipeline row wears {{chip:yellow|⚖ new}}, each job's Activity records the release, and the matter appears on the firm's portal the moment they open it.

## 6. Send the firm their link

{{button:outline|🌐 Firm's link}} on the desk header mints one private link, no sign-in. {{button:blue|Copy link}} and send it however you like — the firm keeps the same link for every matter you ever release. **Rotate** replaces it; **Turn off** is the kill switch. Details: [share your attorney their portal](/help/share-your-attorney-their-portal).

On the portal's **Notifications** page the firm adds its own people and gives each one rule: right away or a weekly digest, every matter or only theirs. A new address is inert until its owner clicks the confirmation, and every email carries a one-click stop. The office sees the same list under {{button:outline|✉ Firm's emails}} with two overrides, remove a person and pause everything. Details: [manage who at the law firm gets emails](/help/manage-who-at-the-law-firm-gets-emails).

## 7. The firm works the matter

On the portal's **Fees & steps** the firm adds fees and costs, records steps (demand sent · suit filed · judgment · settled), records a payment they received, and asks the office questions. Each one lands on the Dashboard for office roles as **"The law firm has N things for you"**; its button opens the desk on that account's Fees & steps tab.

- A **question** — answer it inline; the answer shows on their portal and emails the people who chose right away.
- A **fee, cost or step** — {{button:outline|Acknowledge}}. Steps move the account's stage on the Pipeline row chip.
- A **payment received** — apply it on the job with {{button:outline|Mark Paid}}, then {{button:outline|Mark applied}} on the desk; the recovery and the firm's contingency are recorded on the matter.

The firm never marks anything paid, edits a job, or emails the customer through Click.

## 8. How it ends

- **Settled** — the firm records the step; the matter closes as {{chip:green|Settled}} once the money is applied.
- **Written down** — {{button:outline|Write down…}} on the desk records the agreed write-down on the largest open bill line and closes the matter as {{chip:gray|Written down}}.
- **Pulled back** — a dev's {{button:outline|Pull back}} returns the account to review; it leaves the portal on the firm's next open, and their fees and steps stay on the record.

Closed matters sit under **Closed** on the desk's rail so the history is one click away.
