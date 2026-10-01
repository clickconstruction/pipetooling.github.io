---
title: let a customer pay by bank transfer or mailed check
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: ACH, wire, bank transfer, direct deposit, routing number, account number, remittance, mail a check, check address, portal statement, accounts receivable
---
Some customers pay by bank transfer or a mailed check instead of the online button. Their statement page carries the details they need.

They may pay by ACH, a direct bank deposit, by wire, a same-day bank transfer, or by a mailed check. That is instead of the {{button:blue|PAY ONLINE}} button. The details sit collapsed under the ledger on their statement page. The office can read the same details inside **Accounts Receivable** while a customer is on the phone. The numbers live in the database only, never in the app's source. So publishing the app never publishes the account.

## Enter the details once

A master or dev opens **Settings → Company → Bank transfer details** and fills in:

- **Pay to** is the legal name on the account, exactly as the bank has it.
- **Routing number** and **Account number**. The routing number is checked for a typo before it saves.
- **Bank name** and the **note under it**. For a Mercury account, the bank is the partner bank. So the note tells the customer why their bank shows a different name.
- **Beneficiary address**. Some wire forms require it.
- **Where checks must be mailed**. The statement then reads *Checks can only be received at … Checks mailed anywhere else need to be re-issued.* You leave it blank and the checks line disappears.

The **Show on the customer statement page** box turns the whole card on or off without clearing anything. Nothing shows to a customer until the payee, routing and account are all filled. A check address alone also makes it show.

## What the customer sees

Under **Total due** on their statement page sits one quiet line: **Prefer to pay with a different method?** The customer taps it and two halves open. One half is the transfer details. The other is a separate box for checks. So the bank's beneficiary address and the check mailing address are never confused for each other:

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

The memo line is built for them from their name and their open job numbers. So the deposit lands with the words Accounts Receivable needs to match it. A printed statement carries the card open. Paper is where wire details get used.

The last line offers the office number. A customer may one day get an email with different bank details in your name. That call is what catches it. So keep the number current.

## Reading them in Accounts Receivable

You open **Accounts Receivable** from Jobs → Pipeline → Billed Awaiting Payment. You click {{button:outline|🏦 Bank transfer details}} in the header. The panel shows the same record with {{button:outline|Copy}} chips, the checks line and the guard line. So the answer to "where do I wire it" is one click away. The customer is still on the phone. A master or dev gets a link to Settings → Company from the same panel.

## Keeping the account safe

A routing and account number is printed on every paper check the company writes. So sharing it with customers is the exposure you already carry. Two habits keep it that way:

- You keep the receiving account swept to a working balance. Then an unexpected debit or a counterfeit check bounces instead of clearing.
- You turn on the bank's own ACH debit block or allowlist, if it offers one. You keep debit alerts on. Deposits still come in. Pulls do not.
