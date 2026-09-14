---
title: send a final demand letter
category: Billing & Money
keywords: demand letter, final demand, collections, certified mail, tracking number, deadline, escalate, lien instruments, theft of services, chapter 53
roles: dev, master_technician, assistant, controller
---
When calls and re-sends have not shaken a payment loose, the next step is a **final demand letter** — a formal, dated deadline with legal follow-through named in writing. The app now writes it from the job's real history and holds you to the deadline you set.

## Open Lien instruments

On a **Billed Awaiting Payment** or **Collections** row, the orange lien icon now opens **Lien instruments**. The demand letter is the first tab (the § 53.056 notice and mechanic's lien tabs arrive with the next phase; the {{button:outline-blue|lientooling.com ↗}} button still opens the old external forms).

## What fills itself in

- **Who owes it** — read from the bill, never typed. A bill addressed to the GC is demanded of the GC; a bill to the customer, of the customer; a bill with a typed payer, of that payer. On a job with a GC the block says so and points you to the **§ 53.056 notice** tab — that is the paper the statute sends the property owner, not a demand. The mailing address fills from the payer's record and stays editable; a red {{chip:red|needs a mailing address}} means there is none on file.
- **The debt** — a **statement of account**, one block per bill you select: the invoice number the customer saw (for a Stripe-hosted bill, the number Stripe printed), when it was sent and due, each line as billed, payments and credits, and the balance. It is read-only on purpose: a sworn-account claim wants the name, date and charge of each item with credits allowed, and a demand that does not match the bill costs you attorney's fees. Something wrong? Fix it on the bill and the letter re-reads it.
- **One letter per payer** — the bill chips show who each bill went to when a job's bills go to different payers; picking a bill for another payer starts a letter for that payer.
- **The notice history** — this is the part no form site can write. The letter lists, with dates, every invoice send, every Stripe re-send, and every collection call recorded in call mode: *"July 15 — Invoice sent · August 5 — Invoice re-sent by email · August 26 — Collection call."* A debtor reading a dated list knows you keep records.
- **The two dates** — the pay-by date defaults to 10 business days out (one click resets it). Under it the app shows the date **attorney's fees become recoverable**: 30 days after the letter, because the letter is the "presentment" Texas requires before fees can be claimed. The letter says both.

## What the letter may say

Every line the letter threatens has to be one you can actually do, and every charge it names has to rest on a statute or the agreement — the Texas Debt Collection Act applies to you when the debtor is a homeowner. So each switch shows its basis, and a line that is not available is greyed with the reason:

- **Suit in justice court** — offered while the balance is within the $20,000 limit; above it the line reads county or district court.
- **Mechanic's lien under Chapter 53** — offered only while the filing window is open and the property is not a homestead, with the window's last day on the letter. When it cannot be filed the switch says why: {{chip:red|not offered — the filing window closed …}}.
- **Interest** — {{chip:gray|1.5 % a month}} under the Prompt Payment chapter from the 36th day after the bill went out (the bill is the written payment request), or {{chip:gray|6 % a year}} at the legal rate when the bill was never sent. No date to run from, no interest line.
- **Theft of services (§ 31.04)** stays **off** until the attorney package signs off on it.

:::example The lawyer's date
A letter sent September 14 names September 28 as the pay-by and October 14 as the day fees become recoverable. The Legal desk shows the same October date on the account's Paper tab, so a matter referred after it arrives with the presentment already done.
:::

## What goes out with it

The letter never goes alone. Under **Enclosed**:

- **Exhibit A — the invoice**, always: the bill as the customer received it, one per bill the demand covers, stamped on every page.
- **Exhibit B — the signed agreement**, when the job has one on file (untick it to leave it out).
- **Exhibit C — the delivery record**: the dated sends, re-sends, calls and promises the letter cites, on one page the debtor can check against their own inbox.

The letter names them under the statement and in an *Enclosures* line at the foot. The preview shows each exhibit as the page it will be. {{button:outline-blue|Print packet}} opens one PDF — the letter, then every exhibit — and {{button:outline-blue|Download PDF}} saves the same file.

## Record the send

{{button:blue|Save & record send…}} asks how it physically went out — **certified mail**, traceable courier, email, or hand-delivered — plus the tracking number and the mailing date (a notice is effective the day it's mailed). That creates the record; nothing sends from the app, so the legal path stays physical and provable.

## The deadline watch

Once recorded:

- The job's lien icon wears an **amber ring** while the letter is out, and the modal lists every sent letter with **View** (the exact document again) and **Void** (withdrawn or recorded in error).
- If the deadline passes with the covered lines still unpaid, a **red Needs-you card** appears: *"A demand-letter deadline passed unpaid"* — because the fastest way to make demand letters worthless is to not do the thing they promised. It clears itself when payment lands or the letter is voided.
