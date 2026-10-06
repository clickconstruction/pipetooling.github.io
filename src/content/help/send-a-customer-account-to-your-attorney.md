---
title: send a customer account to your attorney
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: legal, attorney, law firm, collections, attorney ready, release, portal, link, needs you, pull back, write down, settled, fees, contingency, sworn account, lien
---
When a customer will not pay, one law firm does the pursuing. Click hands them everything on the account.

This guide is the whole path, start to finish. The guide covers moving a job to Collections, the review and the release. The guide also covers what the firm does, and how a matter ends. The three guides it links to go deeper on each surface.

## 1. Move the job to Collections

On **Jobs → Pipeline → Billed Awaiting Payment**, you press the row's **Collections** button. On phone cards, the row's menu has {{chip:yellow|Flag for collections}}. Call mode has the same door, called **Move to Collections…**. The confirm step takes an optional note on why the office thinks this one will not pay on its own. The attorney reads that note first. Any office role can do this. The job moves to the **Collections** section, below Billed Awaiting Payment, and keeps its balance.

Nothing reaches an attorney yet. Collections is the office's holding pen. The firm only ever sees what a dev releases.

## 2. A dev gets a card

Every Collections account that has not been reviewed shows on the dev's Dashboard, oldest first. The card reads **"N Collections accounts await your review before an attorney sees them"**. Its button opens the Legal desk on that account. Office staff who want a dev's eyes sooner press {{button:outline|Ask a dev to review…}} on the desk. A short note goes with the ask. That account goes to the top of the card.

## 3. Review the account the way the firm will see it

On **Jobs → Pipeline**, the **Collections** header carries {{button:outline|⚖ Legal}}. On a computer the button sits at the header's right, just before **Lien desk**. Legal sits where Billed has Accounts Receivable. Legal opens the desk on every Collections account, the ones worth the most first.

An account is the **payer**. The payer is the GC when one pays, otherwise the customer. An account spans every Collections job that payer owes on. For each account, the desk says these at the top:

- **Theory** is what an attorney could plead: {{chip:green|Signed contract}}, {{chip:yellow|Sworn account}}, {{chip:yellow|Lien only}} or {{chip:red|None yet}}. The theory is the legal ground an attorney could sue on.
- **Click keeps** is the balance less the firm's contingency and a filing cost. The contingency is the firm's share of what it recovers. Click keeps comes with a verdict: *worth it*, *marginal* or *not worth it*.
- **Before this goes to an attorney** lists {{chip:red|fix}} items an attorney asks for first. The list also shows {{chip:yellow|note}} items worth knowing. Most items have a button to the surface that owns the record.

Then come five tabs: ***Account · Paper · Their word · Evidence · Fees & steps***. The tabs are built from the same records the firm's portal is built from. You fix what the gap list says. You tick or untick what the firm may read on **Their word**, and come back. The firm sees that tab as **Record of contact**. Details: [review a collections account before it goes to your attorney](/help/review-a-collections-account-before-it-goes-to-your-attorney).

:::example Not every account should go
Surf Thru Express Car Wash owes $250 on one job with no agreement and no field evidence. The desk reads {{chip:red|None yet}} and **Click keeps −$182 · not worth it** — the firm's third and a filing cost eat more than the balance. {{button:outline|Write down…}} is the honest exit for that one; the firm never needs to see it.
:::

## 4. Set the firm up once

**Settings → Jobs & billing → Collections law firm** is for devs. The setting holds the firm's name, the handling person, and a contact email and phone. The setting also holds the fee model behind "Click keeps": the contingency % and filing cost. Below it, **Click's particulars for filing** show on the firm's portal as **Particulars for filing**. The particulars are the legal entity, license, registered agent, custodian of records and affiant. The particulars also include the office phone and email, and a W-9 note. So a petition or lien affidavit needs nothing from you. One firm at a time.

The contact email is a contact, not a subscription. The firm's own people decide who gets emails, on their portal.

## 5. Mark it attorney-ready — that is the release

Only a dev sees {{button:dark|⚖ Mark attorney ready…}}. The sheet says exactly what goes: jobs, balance, theory, exhibits, and how many entries are held back. The sheet names the handling person at the firm. The sheet lists who at the firm will hear. Each person's row starts with {{chip:red|Email now}}, {{chip:gray|In their digest}}, {{chip:yellow|Not confirmed}} or {{chip:gray|Not emailed}}. The sheet takes a note for the firm. The sheet warns when red gaps are still open. You can mark anyway, and the packet's cover sheet says so.

You confirm, and the account moves to **With the firm** on the desk's rail. The Pipeline row wears {{chip:yellow|⚖ new}}. Each job's Activity records the release. The matter appears on the firm's portal the moment they open it.

## 6. Send the firm their link

{{button:outline|🌐 Firm's link}} on the desk header creates one private link, with no sign-in. You press {{button:dark|Copy link}} and send it however you like. The firm keeps the same link for every matter you ever release. **Rotate** replaces it. **Turn off** is the kill switch. Details: [share your attorney their portal](/help/share-your-attorney-their-portal).

On the portal's **Notifications** page, the firm adds its own people and gives each one rule. The rule is right away or a weekly digest, and every matter or only theirs. A new address gets nothing until its owner clicks the confirmation. Every email carries a one-click stop. The office sees the same list under {{button:outline|✉ Firm's emails}}. The office list has two overrides: remove a person, and pause everything. Details: [manage who at the law firm gets emails](/help/manage-who-at-the-law-firm-gets-emails).

## 7. The firm works the matter

On the portal's **Fees & steps**, the firm adds fees and costs. The firm records steps: demand sent, suit filed, judgment, after judgment, and payment plan. It also records how it ended: settled, uncollectible or dismissed. The firm records a payment it received, and asks the office questions. Each item lands on the Dashboard for office roles as **"The law firm has N things for you"**. Its button opens the desk on that account's Fees & steps tab.

- A **question**: you answer it inline, in the desk's conversation table. The answer shows under the question on their portal too. The answer also emails the people who chose right away.
- A **fee, cost or step**: you press {{button:outline|Acknowledge}}. Steps move the account's stage on the Pipeline row chip.
- A **step that would move the stage back**: a demand after a judgment, say. The step is recorded, but the stage stays put. Press **Move it back** to accept it, or **Keep** to leave the stage where it is.
- A **payment received**: you apply it on the job with {{button:outline|Mark Paid}}. Then you press {{button:outline|Mark applied}} on the desk. The recovery and the firm's contingency are recorded on the matter.

The firm never marks anything paid, edits a job, or emails the customer through Click.

## 8. How it ends

- **Settled**: the firm records the step. The matter stays on their portal, so they can record the payment and their last costs. The Pipeline chip reads *settled · close it*. Once the money is applied, press {{button:dark|Close the matter…}} on the desk. It then shows as {{chip:gray|Settled}}.
- **Written down**: {{button:outline|Write down…}} on the desk records the agreed write-down on the largest open bill line. A write-down is the part of the balance we agree to give up. Write down… then closes the matter as {{chip:gray|Written down}}.
- **Uncollectible** or **Dismissed**: the firm records it, and you close it the same way as Settled.
- **Pulled back**: a dev's {{button:outline|Pull back}} returns the account to review. Type why first, because the firm reads it. The firm is emailed the reason. Their portal keeps a read-only page with the reason, their own fees and steps, and the conversation. The account's records leave their portal.

Closed matters sit under **Closed** on the desk's rail. So the history is one click away.

## 6. Ask the firm

On the desk's **Fees & steps** tab, {{button:outline|Ask the firm…}} sends counsel a question. Counsel means the firm's lawyers. Ask the firm can also ask for a **sign-off on one job**. Counsel's memo names the moment for it. That moment is when an owner wants to pay Click direct while the GC is silent. Counsel signs off per job before the office takes the check.

The ask shows on the desk as {{chip:yellow|waiting on the firm}}, with **Withdraw**, until they answer. The answer is {{chip:green|signed off Oct 3}} or {{chip:red|not yet}}. The answer lands on your Needs You card as *The law firm has N things for you*. The card item clears when you acknowledge it.

A sent § 53.056 notice on the Lien desk carries the same door on its footer: *Ask counsel to sign off…*. The door shows when the job's account is with the firm. The footer then reads *counsel signed off Oct 3 · take the owner's payment*. A sign-off moves no money. You still record the payment on the job.
