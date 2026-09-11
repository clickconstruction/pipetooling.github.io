---
title: review a collections account before it goes to your attorney
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: legal, attorney, law firm, collections, packet, sworn account, lien clock, demand letter, worth it, write down, theory, exhibits, contact history
---
Before an account that will not pay reaches a law firm, someone at the office should see exactly what the firm would see — and fix what an attorney asks for first. The **⚖ Legal** desk on the Pipeline's Collections section is that review, one account at a time.

## Open the desk

On **Jobs → Pipeline**, the **Collections** section has its own button tier, like Billed Awaiting Payment's. {{button:outline|⚖ Legal}} opens the desk on every Collections account, largest net first. The desk also opens from a link: `/jobs?tab=stages&legal=1` (or `legal=<payer key>` for one account).

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

{{button:outline|Write down…}} opens the agreed write-down on the account's largest open bill line, for the accounts the desk says are not worth pursuing. Marking an account **attorney-ready** — the step that puts it on a firm's portal — lands with the next release.
