---
title: get a job contract signed
category: Office
roles: dev, master_technician, assistant, controller
keywords: contract, agreement, signature, sign, e-sign, no contract, contract chip, pipeline filter, customer signs, send contract, sign in person, void and redo, paper contract, upload signed copy, signed record, contract book audience, contract sweep, backlog, needs you, not needed, contract floor, small jobs, gc subcontract, new job, does it need a contract
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

## A new job asks once

Save a new job by hand and one small question follows — {{chip:blue|Does J523 need a contract?}} — with the job line and three doors:

- {{button:blue|Send our agreement}} opens the Contract modal prefilled from the job.
- {{button:outline|File a signed copy}} opens it straight onto the filing sheet. On a builder's job this door comes first and reads {{button:blue|File Summit GC's subcontract}} — their paper is the agreement, so file it rather than sending ours.
- {{button:outline|Not needed…}} takes the reason and the job leaves the count.
- **Later** leaves the job in the count for the sweep.

Jobs created from a won bid or an accepted estimate are already covered and never ask; neither do jobs under the floor.

## Not every job needs one

Two things keep the count honest, and both show on the card's third line — {{chip:gray|Floor $2,500 · 9 small jobs not counted · 3 marked not needed}}:

- **The floor.** A dev sets a dollar amount on the card ({{button:outline|change}} · type the amount · Enter; 0 removes it). A job whose amount is under the floor leaves the count, the **No contract** filter and the sweep. A job with **no amount** always stays in — unknown is not small.
- **Not needed.** Open the job's Contract modal and press {{button:outline|Not needed…}} in the footer. Pick why — {{chip:blue|GC job — their subcontract}}, {{chip:gray|Service call}}, {{chip:gray|Warranty / no charge}} — or say it in your own words, then {{button:blue|Mark not needed}}. The row reads {{chip:gray|No contract · not needed}}, the job leaves the count, and nothing goes to the customer. Changed your mind? The modal shows the answer with {{button:outline|Needed after all}}.

:::example A builder's job
Summit GC sends you their subcontract; you don't send them a service agreement. Mark the job **Not needed · GC job — their subcontract**, or better, file their signed subcontract (below) so the row reads signed.
:::

Sending or filing an agreement still works on a not-needed job, and a signed record always wins over the Not needed answer.

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
- {{button:outline|Download PDF}} — the same agreement with blank **Sign** and **Date** rules for a pen, for a customer who signs on paper. It sends nothing and records nothing; print it or attach it to your own email, and when the signed copy comes back, **Already signed? File it** on the sweep (or the Google Doc door below) puts it on the job. The Contract sweep's pane has the same button.

:::example While it's out
The row reads {{chip:yellow|Contract sent · opened 2× · 6d}} and the modal shows an amber strip with the same facts, plus **Resend email**, **Copy link**, **Text link**, **Sign in person**, and **Void & redo**. Need to change the scope or amount? Void & redo voids the sent copy and opens a fresh draft on the **same link** — the customer's bookmark keeps working and shows the new revision.
:::

## What the customer sees

One page on their phone: your letterhead, the job address, the work in plain words, the contract amount and payment line, and the terms one tap away. They type their full name (or switch to **Draw** and sign with a finger), tick **I agree to sign electronically** and the agreement box, and press a button that names the amount — {{button:blue|Sign agreement — $5,000.00}}. Under the signature sits one quiet line — a typed or drawn signature has the same legal effect as ink, and paper is available on request — with **How electronic signing works ▸** at its end; it opens two short paragraphs citing the federal ESIGN Act and the Texas UETA and a **Full disclosure ›** link. The words they saw are kept with the signature. The page then shows the signed record with **Download signed PDF**, and emails them the signed agreement as a PDF; you and the job's leader get an email too, and the row turns {{chip:green|✍ Signed Sep 2 · M. Palmer}}.

The link never dies: it shows the signed record afterwards, a polite note if you voided the contract, and asks them to reply for a fresh one only if 90 days pass without a signature (every resend restarts that clock).

## View the signed record

Once a job reads {{chip:green|✍ Signed}}, the chip opens the **Signed agreement** view instead of the send form — the same view whether the customer signed a contract you sent, uploaded paper, or accepted an estimate online. It shows who signed, when and how, the document exactly as signed, and where it was signed from. The signature closes the document in a slim **Signed electronically** frame with a short record ID (like `E84-9F3A2C`) — the same block on the office record, the customer's page, the printed copy and the PDF. {{button:blue|Share ▾}} holds every door: **Copy link** to the customer's page (contracts), **Email a copy…** (the signed PDF to the customer, the GC, a lender or a teammate — tap a chip or type addresses, add a note), **Text link**, **Download PDF**, **Print**, and for estimate-sourced signatures **Open estimate**. The footer shows who last received a copy, and the job's activity keeps every share. Need a fresh agreement because the scope moved? **Start a new agreement…** opens the send form; a new signature supersedes the old one.

{{gif:get-a-job-contract-signed-view.gif|A signed chip opens the Signed agreement view — the customer's accepted estimate closing with the framed signature block (mark, record ID, name and time, consent line), then Share ▾ and Email a copy… with the signed PDF attached}}

## Already signed? File the Google Doc

Most signed contracts live in Google Docs. Open the Contract modal and press {{button:outline|📄 File a signed contract}} in its top-right corner. In Google Docs use **Share → Copy link**, paste it into the box, check who signed and the date (today is filled in), and press {{button:blue|Record as signed}}. Nothing goes to the customer — the row reads {{chip:green|✍ On file · Google Doc}} and the doc opens from the signed record.

Have a paper scan instead? The small **Have a scan or photo instead?** link under the date opens a file field. A record needs the link or a file — not just a name and date.

{{gif:get-a-job-contract-signed-file.gif|From the Pipeline row: the chip opens the Contract modal, File a signed contract opens the sheet, the pasted Google Doc link turns into the green linked line, and Record as signed lights up}}

## Where else it shows

- **Bill Customer** and **View bill** — a strip at the top says whether an agreement is behind the bill, with {{button:blue|Send contract}} or {{button:outline|View record}} right there. Billing is when the office most often notices a missing contract.
- **Job window → Edit** — a *Contract* row under the customer block.
- **Documents → Jobs** — sent, signed and voided contracts list under each job; click one for the signed record: the document as signed, the signature, and who / how / when / from where, with **Print / save as PDF**.

## Your own terms

The built-in terms get you started. To use your own, open **People → Contracts → Contract library**, add a document, and set **Audience** to **Customer — job-contract terms**. It then appears in the Contract modal's **Terms** picker, and every contract sent from it snapshots that version.

## Clear the backlog

The Dashboard's **Needs You** list shows {{chip:yellow|14 live jobs have no contract on file}} with {{button:blue|Start the sweep}}, and a second line for contracts out for signature a week without an answer. The sweep also lives in the Pipeline's **⋯** menu as **Contract sweep…**.

The header counts the pile — *104 without a contract · $1,349,981 of work · 17 need a look* — and **To send · Needs a look · All** splits it. Every row is one job: job · customer, the amount, address · stage, the signer's email, and what the app already knows:

- {{chip:green|Ready}} — the email parses, the scope says more than the job's name, the job has an amount. {{button:blue|Send}} sends it.
- {{chip:yellow|Scope is just the name}} — no fixtures and no accepted-estimate lines, so the agreement would read *Work we'll do: Job*. {{button:outline|Add scope}} opens the Contract modal to type it.
- {{chip:yellow|No amount}} — it would read *Billed at completion (time and materials)*. Send it one at a time if that is right; Send all skips it.
- {{chip:red|No email}} — {{button:outline|Fix email}} opens the job.
- {{chip:blue|GC job · file theirs}} — the customer is a builder; their subcontract is the agreement. {{button:blue|File theirs}} opens the filing sheet.
- {{chip:blue|+ J798}} — this customer has another job in the sweep; each job sends its own agreement.

**The sweep shows the agreement before it sends.** Tap a row and the right side shows that job's agreement exactly as the customer will see it — letterhead, the work, the amount and payment line, the terms — built from the job's fixtures (or its accepted estimate) and the terms you pick above it. Fix the signer's email in the **To** box, and type the **Scope** (one line per item) and the **Amount** right above the document — the page redraws as you type and the edits save to the job's draft, so what you see is what goes out. A row that read {{chip:yellow|Scope is just the name}} turns {{chip:green|Ready}} once the scope says more. The footer says what the button will do — *Emails kcallison@tfharper.com · then J363* — and {{button:blue|Send & next}} sends it and lands you on the next job. {{button:outline|Skip}} moves on without sending.

:::example The footer follows the row
On a builder's job the primary reads {{button:blue|File their subcontract}} (their paper is the agreement) with {{button:outline|Send ours instead}} beside it. A thin scope or no amount dims Send & next and offers {{button:outline|Send anyway}} — the sentence says what is unusual. No email? {{button:blue|Fix email on the job}}. **Already signed? File it** and **Open the full editor** sit at the left of the footer.
:::

**File a signed copy from the sweep.** {{button:outline|Already signed? File it}} at the left of the footer (or {{button:blue|File their subcontract}} on a builder's job) opens the filing sheet right in the pane: paste the Google Doc link or attach the scan, check who signed and when, {{button:blue|Record as signed}}. Faster still, **drag the PDF or photo onto the row** — the row lights up with *Drop to file as the signed copy*, the sheet opens with the file in it, and one click records it. The row leaves the queue and the header counts it.

If the job already has a draft or a contract out for signature, the pane shows that one — the send reuses it rather than making a second — and the full editor is where to change it.

**Already signed, but in Google Drive?** A dev can run **⋯ → Look in Drive for signed contracts…**: the app reads the jobs Shared Drive, matches contract-looking files to the jobs in the sweep by folder and file name, and shows {{chip:green|Confident}}, {{chip:yellow|Check}} and {{chip:gray|No match}} groups with the reason on every row. {{button:blue|File the 31 confident}} files them all with the Drive link as the signed copy; **File** on a Check row does one. Nobody is emailed.

**Send all** lives under **⋯** at the top right: it takes only {{chip:green|Ready}} rows and asks once with the real number — *Email 81 customers (87 agreements)?* — before anything goes out. Rows leave the list as they send, and the Dashboard count falls with them. On a phone the list is the screen; tap a job to see its agreement.

## Reminders and the customer's account page

Leave **Remind by email every 3 days until signed** ticked when you send and the app follows up by itself — up to three reminders, each carrying the same link, with your address as the reply-to. Signing (or voiding) stops them; a resend restarts the clock. Devs can pause the whole lane from Settings with the `job_contract_reminders_disabled_v1` switch.

Customers with a portal link also see **Your agreements** on their account page: signed contracts with **View signed copy**, and any contract still waiting with **Review & sign** — the same durable link, so nobody has to dig for the email.

