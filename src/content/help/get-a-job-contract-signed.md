---
title: get a job contract signed
category: Office
roles: dev, master_technician, assistant, controller
keywords: contract, agreement, signature, sign, e-sign, no contract, contract chip, pipeline filter, customer signs, send contract, sign in person, void and redo
order: 74
---
Every job should have a signed agreement with its customer on file — including jobs that already started. The app tells you which ones don't, and gives the office one place to send and track them.

## Read the chip

On **Jobs → Pipeline**, every job row carries a contract chip under the job name:

- {{chip:gray|No contract}} — nothing on file yet. This is the list to work.
- {{chip:yellow|Contract sent · opened 2× · 6d}} — out for signature: how many times the customer opened it and how long ago it went out.
- {{chip:green|✍ Signed Sep 1 · M. Palmer}} — signed electronically, with the signer and date.

:::example Some jobs are already covered
An estimate the customer accepted online, a bid the GC signed in the bid room, or a signed paper copy you uploaded all count as the agreement. Those rows show {{chip:green|✍ Signed · estimate #84}}, {{chip:green|✍ Signed · bid room}}, or {{chip:green|✍ On file · paper}} — no need to send anything.
:::

Hover the chip for the full story (who it went to, whether it's been opened).

## Find the jobs without one

Open the **⋯** menu at the right end of the Pipeline search bar. Under **Filters**, the contract dropdown offers **No contract**, **Contract out for signature**, and **Contract signed**. Pick one and every section follows; a chip in the search bar shows the filter is on — tap its × to clear.

## Send a contract

Tap the {{chip:gray|No contract}} chip on the row, or the **✍** icon in the row's quick-action stack. The Contract modal opens with everything prefilled from the job:

- **Who signs** — name, email and mobile from the job's customer; add a GC, spouse or property manager under **Also send to**.
- **What they're signing** — the terms document from the Contract Book (or the built-in service-agreement terms until you add one), the scope one line per item, anything not included, the amount, payment terms as chips ({{chip:blue|50% down, balance on completion}} is the default), optional dates and a note.
- Everything autosaves as you type; there is no Save button. {{button:outline|Preview as customer}} opens the document exactly as they will see it.

Then pick a door:

- {{button:blue|Send by email}} — the customer gets a short email with a **Review & sign** button. Your address is the reply-to.
- {{button:outline|Copy link}} — paste it anywhere. {{button:outline|Text link}} opens your phone's messages with the link ready to send.
- {{button:outline|Sign in person}} — opens the signing page on this device so the customer can sign at the kitchen table.

:::example While it's out
The row reads {{chip:yellow|Contract sent · opened 2× · 6d}} and the modal shows an amber strip with the same facts, plus **Resend email**, **Copy link**, **Text link**, **Sign in person**, and **Void & redo**. Need to change the scope or amount? Void & redo voids the sent copy and opens a fresh draft on the **same link** — the customer's bookmark keeps working and shows the new revision.
:::

## What the customer sees

One page on their phone: your letterhead, the job address, the work in plain words, the contract amount and payment line, and the terms one tap away. They type their full name (or switch to **Draw** and sign with a finger), tick the agreement box, and press a button that names the amount — {{button:blue|Sign agreement — $5,000.00}}. The page then shows the signed record and emails them a copy; you and the job's master get an email too, and the row turns {{chip:green|✍ Signed Sep 2 · M. Palmer}}.

The link never dies: it shows the signed record afterwards, a polite note if you voided the contract, and asks them to reply for a fresh one only if 90 days pass without a signature (every resend restarts that clock).
