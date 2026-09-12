---
title: review a collections account before it goes to your attorney
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: legal, attorney, law firm, collections, packet, sworn account, lien clock, demand letter, worth it, write down, theory, exhibits, contact history, attorney ready, release, held back, ask a dev
---
Before an account that will not pay reaches a law firm, someone at the office should see exactly what the firm would see — and fix what an attorney asks for first. The **⚖ Legal** desk on the Pipeline's Collections section is that review, one account at a time.

## Open the desk

On **Jobs → Pipeline**, the **Collections** header carries {{button:outline|⚖ Legal}} beside the count, where Billed Awaiting Payment carries Accounts Receivable. It opens the desk on every Collections account, largest net first. The desk also opens from a link: `/jobs?tab=stages&legal=1` (or `legal=<payer key>` for one account).

An **account is the payer** — the GC when one pays, otherwise the customer — and it spans every Collections job that payer owes on. Two jobs for the same customer are one account, because a petition names one defendant.

## Read the top first

The rail on the left lists accounts by **what Click would keep** if every dollar landed: the balance less the firm's third and a filing cost. Under the account name:

- **Theory** — what an attorney could plead today: {{chip:green|Signed contract}}, {{chip:yellow|Sworn account}} (the customer received the bill, a report or clock session with GPS places a crew on the property, and no dispute is on record), {{chip:yellow|Lien only}}, or {{chip:red|None yet}}.
- **Click keeps** — the balance after the firm's cut and costs, with a verdict: worth it · marginal · not worth it.
- **Against pursuing** — facts on record that argue for writing it down instead: a "no money" note, a dispute, broken promises, a payer that is a name only.

Then **Before this goes to an attorney**: {{chip:red|fix}} items an attorney asks for first (no agreement and no sworn-account basis, no way to reach the payer, no address) and {{chip:yellow|note}} items worth knowing (no demand letter, a lien window still open, an incomplete property record, no field evidence, never asked when they'd pay). Every line has a button that opens the surface that owns the record — Contract desk, Lien instruments, Edit customer, Edit job, Call mode — and the desk refreshes when you come back.

## The five tabs

The same five the firm will see:

- **Account** — who owes, contacts, the jobs, every invoice and payment in date order, and the property record.
- **Paper** — agreements per job with the sworn-account column, the **lien clock** (each job's § 53.056 notice and affidavit deadlines from its last clock-session day; the monthly notice applies when a GC pays), demand letters, lien filings.
- **Their word** — one timeline of everything said: contacts logged on the customer, payment promises and whether they were kept, collection calls, and the collections note. Entries dated **before the first bill are held back** from counsel by default and show struck through.
- **Evidence** — field reports and clock sessions per job, how many carry GPS, hours, first and last work day, photo and Drive links.
- **Fees & steps** — what the office did, in order, and the exhibits the packet would carry, lettered A onward.

Each section title carries an ↗ door to where its data is edited.

:::example A red gap that is not really red
The Learning Experience has no signed contract on either job. With a sent Stripe invoice and 22 GPS clock sessions on the property, the desk reads {{chip:yellow|Sworn account}} and the contract gap is a note, not a stop. The day a dispute is logged in call mode, the theory drops to {{chip:red|None yet}} and the gap turns red — that is the desk telling you the dispute has to be answered before the account is worth referring.
:::

## Two exits

{{button:outline|⎙ Print packet}} prints the cover sheet (theory, worth, the gap list), then the five sections with held entries left out — the browser's print-to-PDF is the PDF a firm receives today.

{{button:outline|Write down…}} opens the agreed write-down on the account's largest open bill line, for the accounts the desk says are not worth pursuing. The matter closes as {{chip:gray|Written down}} and the row leaves Collections when the bill clears.

{{button:blue|⚖ Mark attorney ready…}} is the release, and only a dev sees it. The sheet says what goes — jobs, balance, theory, exhibits, how many entries are held back — names the handling person at the firm and who hears about it, takes a note for the firm, and warns when red gaps are still open (you can mark anyway; the packet's cover sheet says so). Confirm and the account moves to **With the firm**; the row wears a {{chip:yellow|⚖ new}} chip and each job's Activity records the release. **Pull back** (dev) returns it to review; the firm's fees and steps stay on the record.

## Curate what the firm sees

On **Their word**, every entry has a **to counsel** box. Entries dated before the first bill are held unless you tick them; anything after goes unless you untick it. {{button:outline|Only after the first bill ↗}} clears every override; {{button:outline|Share all ↗}} sends everything. Held entries show struck through, never reach the printed packet, and never reach the firm.

## Ask a dev to review

Office staff can move a job to Collections but cannot release it. {{button:outline|Ask a dev to review…}} takes a short note and puts the account at the top of the dev's Needs You card — "N Collections accounts await your review before an attorney sees them" — which opens the desk on that account. The rail shows who asked and how many days ago; **Withdraw the request** takes it back.

## The firm

Settings → Jobs & billing → **Collections law firm** (dev) holds the firm's name, the handling person, a contact email and phone, and the fee model (contingency %, filing cost) behind "Click keeps". The contact email is not a subscription: the firm's own people and their email rules come from the portal's Notifications page, and nobody is emailed until they are on that list and confirmed.

## When the firm acts

Once an account is with the firm, their fees, steps, questions and payments received arrive on the desk's **Fees & steps** tab marked {{chip:yellow|waiting on the office}} and on the Dashboard as "The law firm has N things for you". Answer a question inline, acknowledge a fee or step, or for a payment received: apply it on the job with Mark Paid, then press **Mark applied** so the recovery and the firm's cut are on the record.

The whole path, from moving a job to Collections to the matter closing, is in [send a customer account to your attorney](/help/send-a-customer-account-to-your-attorney).
