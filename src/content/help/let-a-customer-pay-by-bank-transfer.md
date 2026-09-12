---
title: let a customer pay by bank transfer or mailed check
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: ACH, wire, bank transfer, direct deposit, routing number, account number, remittance, mail a check, check address, portal statement, accounts receivable
---
Some customers pay by ACH, wire or a mailed check instead of the {{button:blue|PAY ONLINE}} button. Their statement page carries the details they need, collapsed under the ledger, and the office can read the same details inside **Accounts Receivable** while a customer is on the phone. The numbers live in the database only, never in the app's source, so publishing the app never publishes the account.

## Enter the details once

A master or dev opens **Settings → Company → Bank transfer details** and fills in:

- **Pay to** — the legal name on the account, exactly as the bank has it.
- **Routing number** and **Account number** — the routing number is checked for a typo before it saves.
- **Bank name** and the **note under it** — for a Mercury account, the bank is the partner bank, so the note tells the customer why their bank shows a different name.
- **Beneficiary address** — some wire forms require it.
- **Where checks must be mailed** — the statement then reads *Checks can only be received at … Checks mailed anywhere else need to be re-issued.* Leave it blank and the checks line disappears.

The **Show on the customer statement page** box turns the whole card on or off without clearing anything. Nothing shows to a customer until the payee, routing and account are all filled, or a check address is set.

## What the customer sees

Under **Total due** on their statement page sits one quiet line: **Prefer to pay by bank transfer?** Tapping it opens two halves — the transfer details, and a separate box for checks — so the bank's beneficiary address and the check mailing address are never confused for each other:

:::example The opened card
**BY BANK TRANSFER — ACH (DIRECT DEPOSIT) OR WIRE**
**Pay to** Sample Plumbing LLC {{button:outline|Copy}} · **Address** 100 Sample St, Kyle, TX 78640 · *for bank ACH and wires, not for mail* · **Routing** 000000000 {{button:outline|Copy}} · **Account** 0000 1234 5678 · Business checking {{button:outline|Copy}} · **Bank** Sample Bank
*Your bank may show this name instead of ours — that is correct.*
**Memo** `Sam Sample · PLUM 1001, 0994` so we can match your payment the day it lands.

**BY CHECK — MAIL IT HERE** (its own box beside the transfer details, under them on a phone)
**Payable to** Sample Plumbing LLC
**Mail to** 12925 FM 20 · Kingsbury, TX 78638
*Checks can only be received at this address. Checks mailed anywhere else need to be re-issued.*

● You can always call (512) 360-0599 before sending anything for clarity.
:::

The memo line is built for them from their name and their open job numbers, so the deposit lands with the words Accounts Receivable needs to match it. A printed statement carries the card open, because paper is where wire details get used.

The last line offers the office number. If a customer ever gets an email with different bank details in your name, that call is what catches it, so keep the number current.

## Reading them in Accounts Receivable

Open **Accounts Receivable** from Jobs → Pipeline → Billed Awaiting Payment and click {{button:outline|🏦 Bank transfer details}} in the header. The panel shows the same record with {{button:outline|Copy}} chips, the checks line and the guard line, so the answer to "where do I wire it?" is one click away while the customer is still on the phone. A master or dev gets a link to Settings → Company from the same panel.

## Keeping the account safe

A routing and account number is what is printed on every paper check the company writes, so sharing it with customers is the exposure you already carry. The two habits that keep it that way:

- Keep the receiving account swept to a working balance, so an unexpected debit or a counterfeit check bounces instead of clearing.
- Turn the bank's own ACH debit block or allowlist on, if it offers one, and keep debit alerts on. Deposits still come in; pulls do not.
