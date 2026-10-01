---
title: get a job contract signed
category: Office
roles: dev, master_technician, assistant, controller
keywords: contract, agreement, signature, sign, e-sign, no contract, contract chip, pipeline filter, customer signs, send contract, sign in person, void and redo, paper contract, upload signed copy, signed record, contract book audience, contract sweep, backlog, needs you, not needed, contract floor, small jobs, gc subcontract, new job, does it need a contract
order: 74
---
Every job should have a signed agreement with its customer on file, even one that already started. The app shows which jobs don't and gives the office one place to send and track them.

## Read the chip

On **Jobs → Pipeline**, every job row carries one contract chip under the job name. It is the row's only contract button. Before a job is billed, the chip turns amber when the contract is due:

- {{chip:yellow|Contract by Sat Oct 3 · 2d}}: a crew is booked and nothing is on file. Get it signed before that day.
- {{chip:yellow|No contract · crew on site}}: the crew has started and nothing is signed. Send it or file a signed copy.
- {{chip:gray|No contract}}: nothing is on file and no crew is booked yet. A job with no price stays grey too, because a contract names the amount.
- {{chip:gray|No subcontract on file}}: a job billed to a GC. Tap it to file their signed subcontract once. Tick every job it names and they all read signed. Its **Send ours or mark not needed** link opens the Contract window instead.
- {{chip:yellow|Contract sent · opened 2× · 6d}}: out for signature. It says how many times the customer opened it and how long ago it went out.
- {{chip:green|✍ Signed Sep 1 · M. Palmer}}: signed electronically, with the signer and date.

Once a job is billed, a missing contract reads a grey {{chip:gray|No contract}}. A job in **Paid in full** shows no chip. On the phone board, the row's one chip asks only for the two amber cases.

:::example Some jobs are already covered
An estimate the customer accepted online, a bid the GC signed in the bid room, or a signed paper copy you uploaded all count as the agreement. Those rows show {{chip:green|✍ Signed · estimate #84}}, {{chip:green|✍ Signed · bid room}}, or {{chip:green|✍ On file · paper}} — no need to send anything.
:::

Hover the chip for the full story: who it went to, and whether it's been opened.

## Find the jobs without one

**Jobs → Pipeline** opens with a card under **Today's money opportunities**. It reads {{chip:yellow|✍ Get contracts signed — 58 live jobs without, $412k of work}}. It counts every stage except Paid in full. Accepted estimates and bid-room signatures already count. Beside the headline, one count per stage shows the gap, in two short rows. Tap {{chip:yellow|15 working}} and the board filters to those jobs and jumps to that section. A stage with nothing missing reads {{chip:green|✓ ready to bill}}. {{button:blue|Start the sweep →}} opens the sweep described below. When every live job is covered, the card becomes a single green line.

## A new job asks once

Save a new job by hand and one small question follows. It reads {{chip:blue|Does J523 need a contract?}} with the job line and three doors:

- {{button:blue|Send our agreement}} opens the Contract modal, the contract's pop-up window, prefilled from the job.
- {{button:outline|File a signed copy}} opens it straight onto the filing sheet. On a builder's job this door comes first and reads {{button:blue|File Summit GC's subcontract}}. A subcontract is the builder's own contract with us. Their paper is the agreement, so file it rather than sending ours.
- {{button:outline|Not needed…}} takes the reason and the job leaves the count.
- **Later** leaves the job in the count for the sweep.

Jobs created from a won bid or an accepted estimate are already covered and never ask. Neither do jobs under the floor.

## Not every job needs one

Two things keep the count honest. Both show on the card's third line. It reads {{chip:gray|Floor $2,500 · 9 small jobs not counted · 3 marked not needed}}:

- **The floor.** A dev sets a dollar amount on the card. Press {{button:outline|change}}, type the amount, and press Enter. 0 removes it. A job whose amount is under the floor leaves the count, the **No contract** filter and the sweep. A job with **no amount** always stays in. Unknown is not small.
- **Not needed.** Open the job's Contract modal and press {{button:outline|Not needed…}} in the footer. Pick why: {{chip:blue|GC job — their subcontract}}, {{chip:gray|Service call}} or {{chip:gray|Warranty / no charge}}. Or say it in your own words. Then press {{button:blue|Mark not needed}}. The row reads {{chip:gray|No contract · not needed}}. The job leaves the count, and nothing goes to the customer. Changed your mind? The modal shows the answer with {{button:outline|Needed after all}}.

:::example A builder's job
Summit GC sends you their subcontract; you don't send them a service agreement. Mark the job **Not needed · GC job — their subcontract**, or better, file their signed subcontract (below) so the row reads signed.
:::

Sending or filing an agreement still works on a not-needed job. A signed record always wins over the Not needed answer.

You can also set the filter by hand. Open the **⋯** menu at the right end of the Pipeline search bar. Under **Filters**, the contract dropdown offers **No contract**, **Contract out for signature**, and **Contract signed**. Pick one and every section follows. A chip in the search bar shows the filter is on. Tap its × to clear.

## Send a contract

Tap the {{chip:gray|No contract}} chip on the row. The Contract window opens with everything prefilled from the job, in two columns. The agreement sits on the left, as the customer will see it. On the right sits one question: **How this one gets signed**.

{{gif:get-a-job-contract-signed.gif|From the Pipeline row, the chip opens the Contract window. The agreement sits on the left as the customer sees it, edited in place. The rail on the right has the answer picked and one button that follows it}}

**The agreement** is the paper itself, laid out as the customer will see it. It holds your letterhead, the work, the price and payment line, the terms, and the signature frames. You edit it in place. Hover a line and it says it edits. Press it and the field opens where the text was. Click away to keep it. Empty things are faint lines you tap to add: *+ not included…*, *+ start and estimated completion*, *+ a line the customer reads before the work*. Press the payment sentence and the presets appear as chips. {{chip:blue|50% down, balance on completion}} is the default.

- **The amount is the job's number**, never typed here. It is the estimate the customer accepted when there is one, else the job's line items. The price line reads *$123,600 · from the job's 14 line items · adjust*. The adjust door opens the job. The agreement follows what you change there. So the signed agreement and the bill can never disagree.
- **The terms** are the Contract Book's. They are named on the paper with their clause count and date. The line reads *Terms · Service agreement · 12 clauses · updated Sep 29*. **read all** and **edit the wording** sit beside them. Editing the wording changes every later agreement.
- Everything saves as you type. There is no Save button and no preview button. The paper is the preview. A start or completion date left half typed holds the save until the year is finished. Half typed means a year typed as `26`, say. The line under the paper says *Not saved: a date is not finished*. Nothing goes out over it either. The send button, **Copy the link**, **On paper** and **File their signed contract** all stop. A line names the date, like *Finish the “Start” date before this goes out*. **Open full size** under it opens the printable page. **Download the PDF** beside it is the look-only copy. It records nothing.

**The rail** offers three ways, with the answer already picked from what the job knows. Only the fields the picked way needs appear under it. Then comes one blue button whose label follows the pick. A sentence says exactly what pressing it will do.

- {{button:outline|Send a link}} is *picked when the job has an email or a mobile.* They review and sign on their phone. Email is filled from the job. Tick **Text it too** to open a text with the same link after the email goes. Or leave the email blank and the button reads **Text the link**. **Copies** are for a GC or property manager who only reads it. GC means the general contractor. Reminders go every 3 days until signed, up to 3. **Copy the link** in the sentence pastes it anywhere.
- {{button:outline|Sign here, now}} means the customer signs on this device, at the kitchen table. Nothing is needed but their name. An email is only where their signed copy goes. A technician clocked in on the job has the same door on the Job Mode card. It reads *✍ Hand the phone to the customer to sign*.
- {{button:outline|On paper}} is *picked when the job has neither an email nor a mobile.* **Download to print** gives the page blank **Sign** and **Date** rules. It **marks the agreement handed over**. So the job leaves the count and reads *handed over · awaiting signature*. **Email the PDF** sends it to print, sign and send back, with the signing link riding along.
- A way that cannot run says why and steps aside. It reads {{chip:yellow|Needs an email or a mobile — add one, or pick another way}}. The button greys until it can.

:::example What the button says
{{button:blue|Send the link}} · *Emails sam@example.com a Review & sign link from office@clickplumbing.com. Reminders every 3 days until signed, up to 3.*
{{button:blue|Download & mark handed over}} · *Downloads the PDF with Sign and Date rules and marks the agreement handed over today. The job leaves the count; nothing is emailed.*
:::

On a builder's job the rail leads with {{button:outline|File Summit GC's subcontract}}. Their paper is the agreement. It keeps our three ways one tap behind **Send ours anyway**.

Under the rail sit the two exits: **Already signed outside the app? File their signed contract** and **This job doesn't need one? Not needed…**. The title bar's pill says where the agreement stands. It reads {{chip:gray|Draft · nothing sent yet}} or {{chip:yellow|Sent Sep 12 · opened 2×}}. It reads {{chip:yellow|Handed over Sep 12 · awaiting the signed page}} or {{chip:green|✍ Signed Sep 14 · M. Palmer}}.

## How this one gets signed

On the Contract sweep, every job's pane asks **How this one gets signed** as one row of three. The answer is already picked for the kind of row it is. A line underneath says what the chosen way does. The other ways are one tap away:

- **Email the PDF to sign by hand** is picked on a homeowner's row. The app emails the agreement as a PDF to print, sign and send back. The signing link sits underneath as a second way. It asks first and names the address. The job reads *PDF emailed · awaiting signature*. Reminders go out as for any sent agreement. This is how this office's finished contracts have actually been signed.
- **Email a signing link** means they sign on a screen, no printing.
- **Download to print** is picked when the job has no email. It is for the counter or the mail. It downloads the page **and marks it handed over**. The agreement counts as sent. The job leaves the pile and reads *handed over · awaiting signature*, with no email and no reminders. {{button:outline|Preview PDF}} at the left of the footer is the look-only version. It records nothing.
- **File their subcontract** is what a builder's row shows, and only this. A builder sends us their paper, so ours is the wrong document. **Send ours anyway** underneath opens the three ways above if you really mean to.

One blue button at the bottom right follows the pick. It reads {{button:blue|Email PDF & next}}, {{button:blue|Send link & next}}, {{button:blue|Download & next}}, or {{button:blue|File their subcontract}}. The sentence beside it says what is about to happen. When a row is not Ready, or nothing follows it, the button is the one-job send instead. That is {{button:blue|Email the PDF}}. {{button:outline|Preview PDF}} and **⋯ More** sit at the left of the footer. More holds **Open the full editor**. While *& next* is showing, More also holds the one-job send, *Email the PDF — stay on this job*. After a one-job send the pane stays on that job. It shows what went, to whom, {{button:outline|Open the job's contract}} and {{button:blue|Next: J742 ›}}. So nothing is armed on the next customer until you move. When a signed page comes back, open the job's contract and press {{button:blue|File the signed copy}}. Or use the **We already have one** door on the sweep. The same agreement becomes the signed record rather than a second one.

:::example Why the hand-off is recorded
A page downloaded and emailed from your own mail leaves no trace: the job stays in the pile forever and nobody can tell it was ever asked. Download to print says who handed it over and when.
:::

:::example While it's out
The row reads {{chip:yellow|Contract sent · opened 2× · 6d}} and the window's rail shows an amber strip with the same facts, then three groups: **Nudge** ({{button:blue|Resend email}}, **Text the link**, **Copy link**), **Sign here** (**Open the signing page on this device**) and **Change it** (**Edit & re-send** or **Void & redo**). Handed over on paper, the groups are **It's back** ({{button:blue|File the signed copy}}) and **Change it**.

**Need to change it after sending?** It depends on whether they have opened it:

- **They have not opened it** — {{button:outline|Edit & re-send}}. Press it once and the strip says what they may be holding (nothing yet, or *revision 1 as a PDF in their inbox*); press {{button:blue|Confirm — unlock to edit}} and the same agreement unlocks right there as the next revision. Fix the scope, the amount or the email and send again — the **same link** carries it, and shows nothing in between. No voided copy is left behind in the history.
- **They have opened it** — the button is gone and the strip says why: what they read stays on the record. {{button:outline|Void & redo}} voids the sent copy and opens a fresh draft on the same link, so their bookmark keeps working and shows the new revision.
- **It was handed over on paper** — the page is already in their hands, so it is Void & redo there too.

:::example A typo caught an hour later
You send J363's agreement at 9:00 with $3,140 where $31,400 belongs — a line item on the job was typed short. At 10:00 the strip still reads *not opened yet*: fix the line item on the job, **Edit & re-send**, press {{button:outline|Use the job's $31,400}} on the amber line, **Send** — revision 2 goes out on the link they already have. Before this, that was a void and a new contract each time; one job collected three voided copies in a day.
:::
:::

## What the customer sees

The customer sees one page on their phone. It holds your letterhead, the job address, the work in plain words, and the contract amount and payment line. The terms are one tap away. They type their full name. Or they switch to **Draw** and sign with a finger. They tick **I agree to sign electronically** and the agreement box. They press a button that names the amount: {{button:blue|Sign agreement — $5,000.00}}. Under the signature sits one quiet line. It says a typed or drawn signature has the same legal effect as ink, and paper is available on request. **How electronic signing works ▸** sits at its end. It opens two short paragraphs citing the federal ESIGN Act and the Texas UETA. Those are the two e-signature laws. It also shows a **Full disclosure ›** link. The words they saw are kept with the signature. The page then shows the signed record with **Download signed PDF**. It emails them the signed agreement as a PDF. You and the job's leader get an email too. The row turns {{chip:green|✍ Signed Sep 2 · M. Palmer}}.

The link never dies. It shows the signed record afterwards. It shows a polite note if you voided the contract. It asks them to reply for a fresh one only if 90 days pass without a signature. Every resend restarts that clock.

## View the signed record

Once a job reads {{chip:green|✍ Signed}}, the chip opens the same **Contract window**, now on its signed state. That holds whether the customer signed a contract you sent, or the office filed paper or a Google Doc. It holds when the customer accepted an estimate online too. The left column is the agreement exactly as signed. It is the paper with the signature closing it, or the accepted estimate's record. The signature is the drawn mark when they drew, then *Signed electronically by …*, the time and *consent recorded*. The right column says who signed, when and how, where from and on what device. It says which document at which revision. Then come the doors:

- **Share**: {{button:blue|Email a copy…}} sends the signed PDF, or the filed link, to the customer or anyone else. It records who got it. **Copy link** copies the customer's page, which now shows the signed record. **Text link** shows when a mobile is on file.
- **Keep**: **Download PDF** gives the stored copy, or one built on the spot. **Open uploaded copy ↗** is for a paper scan. Then come **Print / save as PDF**, and the filed **Google Doc** with its own copy-link button.
- **Later**: {{button:outline|Start a new agreement…}} turns the window back into a fresh draft. A new signature supersedes the old one, which stays under **History**. Then comes **Open job**. An accepted estimate adds **Open estimate #N**.

The line under the doors says when a copy last went out and to whom. Older signed agreements sit under **History** on the left. **View** shows one in place, with *← Back to the current agreement* in the rail.

## A second signer

Both spouses sign a homestead's improvement contract. Some jobs have two decision-makers. On the paper, under the customer's signature frame, press **+ a second signer**. Type their full name, and their email if you have it. The paper now shows two frames, *Sam signs here · Alex signs here*. The PDF prints two pairs of pen rules. The customer's page shows a frame for each. Either may sign first. While both frames are open the page asks **Who is signing now?** Once one has signed, the other sees *Sam has signed — waiting on Alex's signature* and the form for their own frame. When the second signer's email is on file, they get the link the moment the first signature lands.

The agreement reads {{chip:green|✍ Signed}} only when both frames are filled. The signed copy goes out only then too. Until then the chip and the window's pill say **1 of 2 signed**. The window says who it is waiting on. Reminders keep going. To take the second signer off a draft, open the frame and press **Remove the second signer**. Once the agreement is out, *Edit & re-send* or *Void & redo* is the way, as for any other change.

## Already have their contract? The field on the job

Open the job with **Edit Job** and find **Customer Contract**. While nothing is on file the row has a field. It reads *Already have their contract? Paste the Drive link…*. In Google Drive use **Share → Copy link**, paste it, and press {{button:green|File it}}. The job reads {{chip:green|✍ On file · Google Doc}} everywhere: the Pipeline, the sweep, and Bill Customer. **Open the contract ↗** on that row goes straight to the file from then on. It is filed as signed by the job's customer. Nothing is sent to them. For a different signer or a date, use the sheet below.

## Already signed? File the Google Doc

Most signed contracts live in Google Docs. Open the Contract modal and press {{button:outline|📄 File a signed contract}} in its top-right corner. In Google Docs use **Share → Copy link** and paste it into the box. Check who signed and the date. Today is filled in. Type its year in full, or the record waits. Press {{button:blue|Record as signed}}. Nothing goes to the customer. The row reads {{chip:green|✍ On file · Google Doc}} and the doc opens from the signed record.

Have a paper scan instead? The small **Have a scan or photo instead?** link under the date opens a file field. A record needs the link or a file, not just a name and date.

{{gif:get-a-job-contract-signed-file.gif|From the Pipeline row, the chip opens the Contract modal. File a signed contract opens the sheet. The pasted Google Doc link turns into the green linked line, and Record as signed lights up}}

## One signed paper for several jobs

A builder often signs one paper that names several of their jobs. File it once and tick the jobs it names. It never covers every job they have.

1. Open the bill with **View bill** or **Bill Customer**.
2. On the contract strip, press {{button:outline|Add the contract}}.
3. Paste the Google Drive link. Have a scan instead? Press **Have a scan or photo instead?** and pick the file.
4. Under **Which jobs does it cover?** this job is already ticked. Tick each other job the paper names. Paid jobs sit behind **Show their paid jobs**.
5. Check **Signed by** and **Signed on**. A blank date files it as signed today.
6. Press the green button. It counts the jobs, as in {{button:green|File for 3 jobs}}.

Nothing is sent to the customer. Each ticked job reads {{chip:green|✍ On file · Google Doc}}. The strip on each one names the jobs the paper covers.

:::example A paper on file for their other jobs
Open the bill of a job the paper does not name yet. The strip says *A signed paper on file covers jobs 251 and 825. Does it name this job too?* Press **Open ↗** to read the paper. If it names this job, press **Add this job to it**. Nothing is added by itself.
:::

The customer's page has an **Agreements** card. It lists each signed paper with the jobs it covers. **Change the jobs…** ticks jobs on or off. **Take it off…** removes the paper from all its jobs. Under the papers is a list of their open jobs with no agreement.

## Where else it shows

- **Bill Customer** and **View bill**: a strip at the top says whether an agreement is behind the bill. With nothing on file it offers {{button:outline|Add the contract}} and {{button:blue|Send one to sign}}. A signed job shows {{button:outline|View record}} instead. Billing is when the office most often notices a missing contract.
- **Job window → Edit**: a *Contract* row under the customer block.
- **Documents → Jobs**: sent, signed and voided contracts list under each job. Click a signed one to open the Contract window on that record. Click an unsigned one to preview it.

## Two kinds of terms

The Contract sweep and the Contract window keep two things apart, because they reach very differently:

- **This job**: the scope, the amount and the **payment line**. They belong to this one agreement. On the sweep, pick the payment line right in the pane. The choices are {{button:outline|50% down, balance on completion}}, {{button:outline|Due on completion}}, {{button:outline|Progress billing}} and {{button:outline|Custom…}}. Custom opens a box for your own sentence. It saves to the job's draft as you pick, and the agreement below redraws.
- **Standard terms**: the numbered legal paragraphs under every agreement. They cover scope, changes, late payment, materials, warranty, permits, cancellation and electronic signature. They are **one Contract Book document**, shown with its version, *Service agreement · v. Sep 20*. An {{button:outline|Edit}} sits beside it.

:::example Editing the standard terms changes every later agreement
{{button:outline|Edit}} opens the wording with a line above it that says how far you are reaching — *This wording goes on every agreement sent from now on — all 105 jobs still waiting in this sweep included.* Saving stamps today as the new version. An agreement that has not gone out yet follows the new wording, a draft saved last week included: the pane and {{button:outline|Preview PDF}} show it, and it is what gets sent or handed over. A draft you wrote in the Contract window from a different document, or from the built-in wording, keeps the terms you chose there. **Agreements already sent or signed keep the wording they went out with**, so you can always say what a customer agreed to. To change one job only, leave this alone and use *This job*.
:::

Anyone in the office can edit the standard terms. The same document is in **People → Contracts → Contract library**. Its audience is ***Customer — job-contract terms***. There you can also add a second one, a commercial agreement, say. The pickers will then offer both.

## Clear the backlog

The Dashboard's **Needs You** list shows {{chip:yellow|14 live jobs have no contract on file}} with {{button:blue|Start the sweep}}. A second line is for contracts out for signature a week without an answer. The sweep also lives in the Pipeline's **⋯** menu as **Contract sweep…**.

The header says how much work has no contract on file, such as *$1,349,981 of work*. It says what this sitting has sent and filed. The list carries its own tabs, each with its count. They are ***Ready to send · Needs a look · All***, and **In Drive** once the Drive pass has found something. Every row is one job. It shows *job · customer*, the amount, *address · stage*, the signer's email, and what the app already knows:

- {{chip:green|Ready}}: the email reads as a real address. The scope says more than the job's name. The job has an amount. {{button:blue|Send}} sends it.
- {{chip:yellow|Scope is just the name}}: no fixtures and no accepted-estimate lines. So the agreement would read *Work we'll do: Job*. {{button:outline|Add scope}} opens the Contract modal to type it.
- {{chip:yellow|No amount}}: it would read *Billed at completion (time and materials)*. Send it one at a time if that is right. Send all skips it.
- {{chip:yellow|Amount differs}}: the job's draft carries a number typed before the amount came from the job. Open it. The amber line says what the draft says. {{button:outline|Use the job's $123,600}} puts the job's number on it. Nothing sends until it does.
- {{chip:red|No email}}: {{button:outline|Fix email}} opens the job.
- {{chip:blue|GC job · file theirs}}: the customer is a builder. Their subcontract is the agreement. {{button:blue|File theirs}} opens the filing sheet.
- {{chip:blue|+ J798}}: this customer has another job in the sweep. Each job sends its own agreement.

**The sweep shows the agreement before it sends.** Tap a row. The right side shows that job's agreement exactly as the customer will see it. That is the letterhead, the work, the amount and payment line, and the terms. It is built from the job's fixtures, or its accepted estimate, and the terms you pick above it. Fix the signer's email in the **To** box. Type the **Scope** right above the document, one line per item. The page redraws as you type. The edits save to the job's draft, so what you see is what goes out. The **Amount** is read out, not typed. It is the job's number with where it comes from. That reads *from the job's 14 line items*, or *from the estimate the customer accepted Sep 12*. **Adjust line items ›** opens the job. A job with no line items reads *No amount — the agreement says time and materials* with **Add line items ›**. A row that read {{chip:yellow|Scope is just the name}} turns {{chip:green|Ready}} once the scope says more. The footer says what the button will do. It reads *Emails the PDF to kcallison@tfharper.com · then J363*. The blue button does it and lands you on the next job. On a homeowner's row it reads {{button:blue|Email PDF & next}}. {{button:outline|Skip}} moves on without sending.

:::example The footer follows the row
On a builder's job the button reads {{button:blue|File their subcontract}} — their paper is the agreement. A thin scope or no amount takes away the *& next* fast path and leaves the one-job button, with the sentence saying what is unusual. No email? The two email ways dim, the line under the row says they need a signer email, and **Download to print** is picked. **Preview PDF** and **⋯ More** sit at the left of the footer.
:::

**The first question first.** The pane opens with the job it is about and one question with two answers. {{button:outline|We need a signature}} means send them ours. {{button:outline|We already have one}} opens the filing sheet right in the pane. Paste the Google Drive link or attach the scan. Check who signed and when. The date starts empty, because a contract already on file was not signed today. Press {{button:blue|File it & next}}. A builder's job opens on that door by itself. Their paper is the agreement. Faster still, **drag the PDF or photo onto the row**. The row lights up with *Drop to file as the signed copy*. The sheet opens with the file in it, and one click records it. The row leaves the queue and the header counts it.

If the job already has a draft or a contract out for signature, the pane shows that one. The send reuses it rather than making a second. The full editor is where to change it.

**The sweep looks in Drive for you.** When it opens it reads the jobs Shared Drive in the background. The header says *checking Drive…* while it reads, and you can work meanwhile. The office shares one reading. After the first person's open it answers at once for everyone for an hour. The ⋯ menu's *Look in Drive* item says how long ago Drive was read. Its window has *read it again* for right after paper was filed or moved. Rows it finds a contract for wear {{chip:green|📄 in Drive}}. They wear {{chip:yellow|📄 in Drive? check}} when it is less sure. A file that names a different address than the job's is never offered, whichever folder it sits in. An **In Drive** tab appears on the list to line them up. Pick one and the pane is already on *We already have one*. The file is named, with an **Open ↗** to look at it. The link is filled in and the date is taken from the file. Check it and press {{button:blue|File it & next}}. It only ever fills the link in. A person files it. To file a whole batch at once, anyone in the office can still run the batch pass. It is **⋯ → Look in Drive for signed contracts…**. The app reads the jobs Shared Drive. It matches contract-looking files to the jobs in the sweep by folder and file name. It shows {{chip:green|Confident}}, {{chip:yellow|Check}} and {{chip:gray|No match}} groups with the reason on every row. {{button:blue|File the 31 confident}} files them all with the Drive link as the signed copy. **File** on a Check row does one. Nobody is emailed.

**Give it the whole screen.** The button beside **⋯** in the title bar takes the sweep full screen. The list, the agreement and its paper sit side by side, each the height of the screen. So nothing scrolls while you check what goes out. Press it again for the window. The sweep opens the way you left it.

**Send all** lives under **⋯** at the top right. It takes only {{chip:green|Ready}} rows. It asks once with the real number before anything goes out. It reads *Email 81 customers (87 agreements)?* Rows leave the list as they send, and the Dashboard count falls with them. On a phone the list is the screen. Tap a job to see its agreement.

## Reminders and the customer's account page

Leave **Remind by email every 3 days until signed** ticked when you send. The app then follows up by itself. It sends up to three reminders, each carrying the same link, with your address as the reply-to. Signing or voiding stops them. A resend restarts the clock. Devs can pause the whole lane from Settings with the `job_contract_reminders_disabled_v1` switch.

Customers with a portal link also see the **Agreements** group of **Your papers** on their account page. It lists signed contracts with **View signed copy**. It lists any contract still waiting with **Review & sign**. That is the same durable link, so nobody has to dig for the email.

## The signed copy

The moment a customer signs on the page, the app emails them their signed copy. The PDF is attached, and the same link stays live. For a paper signature nothing is emailed until you press **Email a copy…** in the Contract window's signed rail. That sends the PDF. Both show as the **Signed copy** step on the customer's *Their journey*. That is on the Customer page and the Job window.
