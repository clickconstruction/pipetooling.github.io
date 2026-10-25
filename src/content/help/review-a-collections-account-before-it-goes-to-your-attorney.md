---
title: review a collections account before it goes to your attorney
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: legal, attorney, law firm, collections, packet, sworn account, lien clock, demand letter, worth it, write down, theory, exhibits, contact history, attorney ready, release, held back, ask a dev, timeline, planned step, plan, what happens next
---
Before an account that will not pay goes to a law firm, the office should see what the firm sees. The Legal desk in the Pipeline's Collections section is that review, one account at a time.

You fix what an attorney asks for first. The **⚖ Legal** desk is where you do it.

## Open the desk

On **Jobs → Pipeline**, the **Collections** header carries {{button:outline|⚖ Legal}}. On a computer the button sits at the header's right, just before **Lien desk**. The stage bar at the top has two more doors on a computer. The scales sit beside the Lien desk's orange gavel, at the bar's right end. The ☰ **Section tools** menu at the bar's left lists **Legal desk** under **Collections**. Each door carries a count when the firm has sent something you have not acknowledged yet. Billed Awaiting Payment carries Accounts Receivable on its own header. You press it to open the desk on every Collections account, largest net first. The desk also opens from a link: `/jobs?tab=stages&legal=1`. You use `legal=<payer key>` for one account.

The desk opens as a window. Press the full screen button at the top right, beside the ✕, to fill the screen. Press it again to go back to the window. The desk remembers your choice on this computer.

If the header reads *Could not read the legal tables*, the desk tries again on its own. Press {{button:outline|Retry}} to read now.

An **account is the payer**. The payer is the GC, the general contractor, when one pays. Otherwise it is the customer. The account spans every Collections job that payer owes on. Two jobs for the same customer are one account. That is because a petition, the paper that starts a lawsuit, names one defendant.

## Read the top first

The rail on the left lists accounts by **what Click would keep** if every dollar landed. That is the balance less the firm's share and a filing cost. Under the account name:

- **Can we sue?** answers first. It reads *Yes*, *Yes, on 2 of 3 jobs*, *Only on the lien* or *Not yet*. The line under it says why. A sworn account is a suit on an itemized bill that someone at Click swears is true and unpaid. The desk says yes on a sworn account when three things are true. The customer received the bill. A report or clock session with GPS places a crew on the property. And no dispute is on record. A lien is a legal claim on the property for unpaid work.
- **How much?** is what they owe. The line under it says how many jobs and how old the oldest bill is.
- **What's left for us?** is the balance after the firm's cut and the filing cost, with a verdict. The verdict is worth it, marginal or not worth it. The line under it says the firm's share and the cost.
- **What could go wrong?** names what hurts the case, in plain words. Examples are a note that they cannot pay, a dispute, broken promises, or a payer that is a name only. Writing it down means lowering a bill to an amount we agree to accept. With nothing to sue on it says *No case yet*.

Then comes **Before this goes to an attorney**. {{chip:red|fix}} items are what an attorney asks for first. Those are no agreement and no sworn-account basis, no way to reach the payer, or no address. {{chip:yellow|note}} items are worth knowing. Those are no demand letter, a lien window still open, or an incomplete property record. They also include no field evidence, or never asked when they'd pay. A demand letter is the formal ask for payment. Most lines have a button that opens the surface that owns the record. That may be Contract desk, the job's Lien window, Edit customer, Edit job or Call mode. The desk refreshes when you come back.

## The tabs

The same tabs the firm will see:

- **Narrative** is your account of the matter, in your own words. The firm reads it first. It is described below.
- **Account** shows who owes, contacts, the jobs, and every invoice and payment in date order. A running balance ends on the balance owed. Each job's property record follows. The property record is the job's own site, not the payer's address. The record shows the owner of record and the owner's mailing address, so the letters have somewhere to go.
- **Paper** shows agreements per job with the sworn-account column, *Where each job stands*, demand letters and *The paper that went out*. *Where each job stands* shows each job's notice and affidavit dates, drawn from its approved hours, its filings and the property kind. *The paper that went out* lists each notice, affidavit and release. An affidavit is the sworn lien filing. The monthly notice applies when a GC pays. *Supply houses* shows each house that sold materials on a job. The card reads what the house is paid and owed and when the house's own notice is due. The figures come from the same books as the Lien window. Record a payment in Materials and the desk reads it paid.
- **Record of contact** is one timeline of everything said, ours and theirs. It holds contacts logged on the customer, payment promises and whether they were kept, collection calls, and the collections note. **Every entry goes to counsel** unless you hold it back. Counsel means the law firm. Held entries show struck through. The firm's portal uses the same name.
- **Evidence** shows field reports and clock sessions per job. It shows how many carry GPS, hours, first and last work day, and photo and Drive links. It also holds the **Documents for the firm**, described below.
- **Fees & steps** shows what the office did, in order. It ends with **What goes to the firm**. That is the records that go with the packet, one fold per kind. Each fold is lettered the way the firm's own packet letters it. Open a fold to see what is inside. Its door reaches the tab that holds the full rows.
- **Timeline** is one dated line of what happened and what is planned next, with notes. The tab is described below.

Most section titles carry an ↗ door to where their data is edited.

:::example A red gap that is not really red
The Learning Experience has no signed contract on either job. With a sent Stripe invoice and 22 GPS clock sessions on the property, the desk reads {{chip:yellow|Sworn account}} and the contract gap is a note, not a stop. The day a dispute is logged in call mode, the theory drops to {{chip:red|None yet}} and the gap turns red — that is the desk telling you the dispute has to be answered before the account is worth referring.
:::

## See every case on the map

The desk has two views, **Accounts** and **Map**. The switch sits at the top right, before the firm's name. Press {{button:outline|Map}} to see every Collections account on a Texas county map.

Each county wears the color of the law firm that covers it. A gray county has no firm yet. Each dot is one account at its job's address. A bigger dot owes more. The dot's color says where the account stands. Amber needs a dev's eyes. Green is with the firm. Gray is given up on. Red sits in a county no firm covers. A red line over the map names those accounts.

**Who covers what** lists each firm with its counties, its cases and what they owe. Tap a county to list its cases on the card under it. Tap a dot to pick one case out. Press **Open on the desk ›** on a case and the desk opens on that account under **Accounts**.

Scroll on the map to zoom. Drag it to move. Press {{button:outline|Central Texas}} or {{button:outline|All of Texas}} to reset the view. A dev colors the counties on **Settings**, then **Jobs & billing**, then **Collections law firms**. Read [set which law firm covers each county](/help/set-which-law-firm-covers-each-county).

## Documents for the firm

Documents can go on the matter. A billing report, a supplier invoice, a signed estimate or a saved email thread all fit. Open the **Evidence** tab. Drop the files on **Documents for the firm**, or press {{button:outline|Choose files}}. Each file needs a title and one line on what it shows. The line is what the firm reads beside the title, so say what the document proves. Give the paper its own day under **Dated**. A contract signed in May sits in May on the Timeline, not on the day you uploaded it. Pick a **State**: Final, Draft or Received. A received paper takes the day it came in. Press {{button:dark|Save}}. The desk takes PDFs, images, emails saved as .eml and plain text, up to 10 MB each.

A draft wears a {{chip:yellow|Draft}} chip, on the desk and on the firm's portal. The firm sees drafts on purpose, so counsel can read a letter before it goes out. When the letter goes out, press {{button:outline|Mark sent…}} on its row. Pick the day, how it went and who it went to. Pick the mailing receipt under the proof, once it is on the matter. The row then reads *Sent Oct 27 by certified mail to Burd & Assoc.* with the receipt one press away. Press {{button:outline|Mark final}} on a draft that is now the paper. Press {{button:outline|Received…}} on a paper that came in. *Not sent after all* clears a record made by mistake.

The firm sees each document under Evidence on its portal, with a link that opens for 15 minutes. The printed packet lists them as one more exhibit. {{button:outline|Hold}} keeps one back from the firm with a reason, such as an internal report. The firm sees only how many were held. {{button:outline|Remove}} takes a document off the matter.
## Write the narrative for the firm

The **Narrative** tab is where you tell the firm the story. Write who did the work, for whom, and where. Then say what happened in date order, what they say against what the record shows, and what is still missing. Press {{button:outline|Start from the outline}} to begin from those four headings. The text is markdown, so ## starts a heading and a table is drawn with pipes. Press {{button:dark|Preview as the firm sees it}} to check it. Then press {{button:dark|Save narrative}}.

The firm reads it as the first tab of its portal, and the printed packet opens with it. A line above it says it is the office's account, with who saved it and when. Name each document by its title under Evidence, so the firm can open it. Keep claims to what the record shows.

## Plan what happens next

The **Timeline** tab is one line of what happened and what is planned next. The line lists every entry on the matter and every document for the firm by day. A **Today** marker splits the line. Items above it happened. Items below it are planned.

To plan a step, fill the **Plan a step** form at the top. Pick the day. Say what will happen in a few words. Add notes on who does it and what goes with it. Press {{button:dark|Add to the timeline}}. The step appears under **Ahead** with the words *Planned. In 5 days.*

A planned step that reaches its day reads *Due today*. A step past its day reads *Overdue by 2 days*. When the step happens, press {{button:outline|Mark done}} on it. Pick the day it was done and say what happened. The step moves to that day and reads *Done Oct 18. Planned for Oct 20.*

Press {{button:outline|Edit}} to change the day, the words or the notes. Press {{button:outline|Hold from counsel…}} to keep a planned step from the firm. Type why, then press {{button:dark|Hold back}}. The firm sees only how many steps were held. Press {{button:outline|Undo…}} to strike a step you planned by mistake. Type why. The step stays on the line, struck through.

The lien clock's deadlines sit on the same line, read only, each a diamond on its day. Each § 53.056 month, the § 53.057 retainage notice, the affidavit and the suit, for every job in the account. A deadline reads *Deadline. In 22 days, by the lien clock.* A passed one reads what the clock knows. Press {{button:outline|Record it…}} on one to open the job's Lien window, where the paper is recorded. When you plan a step, pick the deadline it serves under **Serves the deadline**. The step then names its deadline on the line. A step dated after its deadline reads *after the deadline* in red. A weekend deadline rolls to the following Monday, as the clock has always done.

Something already happened and nobody planned it? Press **Record what happened** above the form. Pick the day it happened. The day cannot be ahead of today. Say what happened in a few words and add notes. Tick the Evidence documents that prove it. Press {{button:dark|Record it on the timeline}}. The event sits on its day with a *happened* chip and its documents. Press {{button:outline|Hold from counsel…}} or {{button:outline|Undo…}} on it, the same as on a planned step. On the Narrative tab, **Insert the events** pastes every recorded event as a dated list under *What happened*.

The firm sees the same timeline on its portal. The firm can plan a step there too. Each step shows who at the firm planned it. A dev's agent can add planned steps through the dev MCP. The agent's steps read *dev MCP* beside the name.

:::example The plan for one account
Burd & Assoc. owes on the Take 5 job and the lawyer is away. The office plans the response letter for Oct 27, the GC's answer for Nov 3 and the offer's end for Nov 11. Two lien notices follow on Nov 13 and Nov 20, and the affidavit on Dec 15 if nothing lands. Each step carries a note on who mails what. When the letter goes out, the office marks that step done and the line shows the day it went.
:::

## Two exits

{{button:outline|⎙ Print packet}} prints the cover sheet, then the five sections with held entries left out. The cover sheet holds the theory, the worth and the gap list. The browser's print-to-PDF is the PDF a firm receives today.

{{button:outline|Write it down…}} sits beside **Mark attorney ready**. It opens a panel under the header that asks **How much will we accept?** for the whole account. A slider, a % box and a $ box move together. The panel shows the split across the account's open bills. For each bill it shows what we forgive and what the bill still owes after. A note of what was agreed is required. The button says exactly what it will do, such as **Write down $811.22 across 2 bills**. Each bill is written down one at a time. A bill the write-down refuses is listed with the reason, and the rest still go. The matter closes as {{chip:gray|Written down}}. The row leaves Collections when the bill clears.

{{button:dark|⚖ Mark attorney ready…}} is the release, and only a dev sees it. It releases to the firm named at the top of the desk. The sheet says what goes: jobs, balance, theory, exhibits, and how many entries are held back. It names the handling person at the firm and who hears about it. It takes a note for the firm. It warns when red gaps are still open. You can mark anyway, and the packet's cover sheet says so. {{button:outline|Preview what the firm sees ↗}} opens their page for this account before anything is released. That page has all five tabs and the exhibits, with held entries left out and your note in place. You confirm, and the account moves to **With the firm**. The row wears a {{chip:yellow|⚖ new}} chip and each job's Activity records the release. **Pull back** returns it to review. Only a dev sees it. The firm's fees and steps stay on the record.

## Curate what the firm sees

On **Record of contact**, every entry goes to counsel. Records can be shown in court either way, so your own lawyer should not be surprised by them.

To keep one entry from the firm, press {{button:outline|Hold back…}} on its row. Type why, then press {{button:dark|Hold back}}. The button stays off until you type a reason. The reason shows under the entry, for the office only.

Held entries show struck through. They never reach the printed packet, and they never reach the firm. The firm sees how many were held, never what or why. {{button:outline|Share}} on a held row sends it again. {{button:outline|Share all ↗}} clears every hold.

## Ask a dev to review

Office staff can move a job to Collections but cannot release it. {{button:outline|Ask a dev to review…}} takes a short note. It puts the account at the top of the dev's Needs You card. The card reads "N Collections accounts await your review before an attorney sees them". It opens the desk on that account. The account's header shows who asked and how many days ago. **Withdraw the request** takes it back.

## The firm

Each account belongs to the firm that covers its county. The firm's name at the top of the desk is this account's firm. The county that picked it sits beside the name, such as **Austin Legal, Travis County**. The county comes from the job's property record. With no record, it comes from where the job's address sits on the map. The line under the account's address says where the county came from.

An amber segment means the desk cannot pick a firm. **No firm covers Williamson County** means nobody covers that county yet. **County unknown** means no job names a county. **Mark attorney ready** waits until that is fixed. The desk never guesses a firm. While no county is colored yet, the one firm takes every account, and the segment says *no counties colored yet*.

Jobs in two firms' counties: the county with the largest open balance decides. A **⇄** segment switches the release to the other firm. An account already with a firm keeps that firm, whatever the map says today.

Press the firm's name to read its details. It holds the firm's name, the handling person, and a contact email and phone. It also holds the fee model behind **What's left for us?**. The fee model is the contingency % and the filing cost. The contingency % is the firm's share of what is recovered. The contact email is not a subscription. The firm's own people and their email rules come from the portal's Notifications page. Nobody is emailed until they are on that list and confirmed.

A dev presses {{button:outline|Firms…}} at the top right. It adds a firm and colors the counties it covers without leaving the desk. The same block lives on **Settings**, then **Jobs & billing**, then **Collections law firms**. Read [set which law firm covers each county](/help/set-which-law-firm-covers-each-county).

## When the firm acts

Once an account is with the firm, their fees, steps, questions and payments received arrive on the desk. Steps, questions and payments land on the **Fees & steps** tab, under **On the matter**, counted as waiting on you. Fees and costs list under **Attorney fees and costs**. They also show on the Dashboard as "The law firm has N things for you". You answer a question inline. You acknowledge a fee or step. For a payment received, you apply it on the job with Mark Paid. Then you press **Mark applied** so the recovery and the firm's cut are on the record.

The whole path runs from moving a job to Collections to the matter closing. It is in [send a customer account to your attorney](/help/send-a-customer-account-to-your-attorney).
