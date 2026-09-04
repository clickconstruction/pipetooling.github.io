---
title: get a job contract signed
category: Office
roles: dev, master_technician, assistant, controller
keywords: contract, agreement, signature, sign, e-sign, no contract, contract chip, pipeline filter, customer signs, send contract, sign in person, void and redo, paper contract, upload signed copy, signed record, contract book audience, contract sweep, backlog, needs you
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

**Jobs → Pipeline** opens with a card under **Today's money opportunities**: {{chip:yellow|✍ Get contracts signed — 58 live jobs without, $412k of work}}. It counts every stage except Paid in full, and accepted estimates and bid-room signatures already count. One chip per stage shows the gap — tap {{chip:yellow|Working 15}} and the board filters to those jobs and jumps to that section; a stage with nothing missing reads {{chip:green|Ready to Bill ✓}}. {{button:blue|Start the sweep →}} opens the sweep described below. When every live job is covered, the card becomes a single green line.

You can also set the filter by hand: open the **⋯** menu at the right end of the Pipeline search bar. Under **Filters**, the contract dropdown offers **No contract**, **Contract out for signature**, and **Contract signed**. Pick one and every section follows; a chip in the search bar shows the filter is on — tap its × to clear.

## Send a contract

Tap the {{chip:gray|No contract}} chip on the row, or the **✍** icon in the row's quick-action stack. The Contract modal opens with everything prefilled from the job:

{{gif:get-a-job-contract-signed.gif|From the Pipeline row: the chip opens the Contract modal prefilled from the job; Copy link mints the customer's signing link and the strip shows where it stands}}

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

One page on their phone: your letterhead, the job address, the work in plain words, the contract amount and payment line, and the terms one tap away. They type their full name (or switch to **Draw** and sign with a finger), tick the agreement box, and press a button that names the amount — {{button:blue|Sign agreement — $5,000.00}}. The page then shows the signed record with **Download signed PDF**, and emails them the signed agreement as a PDF; you and the job's master get an email too, and the row turns {{chip:green|✍ Signed Sep 2 · M. Palmer}}.

The link never dies: it shows the signed record afterwards, a polite note if you voided the contract, and asks them to reply for a fresh one only if 90 days pass without a signature (every resend restarts that clock).

## View the signed record

Once a job reads {{chip:green|✍ Signed}}, the chip opens the **Signed agreement** view instead of the send form — the same view whether the customer signed a contract you sent, uploaded paper, or accepted an estimate online. It shows who signed, when and how, the document exactly as signed, and where it was signed from. The signature closes the document in a slim **Signed electronically** frame with a short record ID (like `E84-9F3A2C`) — the same block on the office record, the customer's page, the printed copy and the PDF. {{button:blue|Share ▾}} holds every door: **Copy link** to the customer's page (contracts), **Email a copy…** (the signed PDF to the customer, the GC, a lender or a teammate — tap a chip or type addresses, add a note), **Text link**, **Download PDF**, **Print**, and for estimate-sourced signatures **Open estimate**. The footer shows who last received a copy, and the job's activity keeps every share. Need a fresh agreement because the scope moved? **Start a new agreement…** opens the send form; a new signature supersedes the old one.

{{gif:get-a-job-contract-signed-view.gif|A signed chip opens the Signed agreement view — the customer's accepted estimate closing with the framed signature block (mark, record ID, name and time, consent line), then Share ▾ and Email a copy… with the signed PDF attached}}

## Already signed on paper?

Open the Contract modal and press {{button:outline|⤴ Upload signed contract}} in its top-right corner. A small sheet asks who signed and the date; attach a scan or phone photo if you have one, and press {{button:blue|Record as signed on paper}}. Nothing goes to the customer — the row simply reads {{chip:green|✍ On file · paper}} and the copy is filed with the job.

## Where else it shows

- **Bill Customer** and **View bill** — a strip at the top says whether an agreement is behind the bill, with {{button:blue|Send contract}} or {{button:outline|View record}} right there. Billing is when the office most often notices a missing contract.
- **Job window → Edit** — a *Contract* row under the customer block.
- **Documents → Jobs** — sent, signed and voided contracts list under each job; click one for the signed record: the document as signed, the signature, and who / how / when / from where, with **Print / save as PDF**.

## Your own terms

The built-in terms get you started. To use your own, open **People → Contracts → Contract library**, add a document, and set **Audience** to **Customer — job-contract terms**. It then appears in the Contract modal's **Terms** picker, and every contract sent from it snapshots that version.

## Clear the backlog

The Dashboard's **Needs You** list shows {{chip:yellow|14 live jobs have no contract on file}} with {{button:blue|Start the sweep}}, and a second line for contracts out for signature a week without an answer. The sweep also lives in the Pipeline's **⋯** menu as **Contract sweep…**.

Every live job without an agreement is one row: job, address, stage, amount, the customer's email, and {{button:blue|Send}}. Pick the terms once in the footer, then send row by row — or {{button:blue|Send all 9 ready}} for every row with a valid email (it asks once to confirm). Rows with no email get {{button:outline|Fix email}}, which opens the job. Click a job name to open the full Contract modal instead, for careful edits or to record a paper copy. Rows leave the list as they send, and the Dashboard count falls with them.

## Reminders and the customer's account page

Leave **Remind by email every 3 days until signed** ticked when you send and the app follows up by itself — up to three reminders, each carrying the same link, with your address as the reply-to. Signing (or voiding) stops them; a resend restarts the clock. Devs can pause the whole lane from Settings with the `job_contract_reminders_disabled_v1` switch.

Customers with a portal link also see **Your agreements** on their account page: signed contracts with **View signed copy**, and any contract still waiting with **Review & sign** — the same durable link, so nobody has to dig for the email.

