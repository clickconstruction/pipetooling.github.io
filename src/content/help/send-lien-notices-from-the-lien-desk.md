---
title: send lien notices from the Lien desk
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: lien desk, lien notice, 53.056, work month, GC, subcontractor, approve, standing rule, on his word, owner of record, deadline, notice due
---
Texas counts lien deadlines from the **month the work was done**, not from the bill. On a job with a GC, every unpaid month needs its own § 53.056 notice by the 15th of the third month after it (the second month on a residential property). The **Lien desk** keeps that queue so nothing closes quietly: the office readies and drafts, the leader approves, and the notice goes out on paper.

## Where it opens

- **Dashboard → Needs you** — {{chip:red|N lien notices to draft}} for the office, {{chip:blue|Approve N lien notices the office drafted}} for the master. Both open the desk in place. Quickfill shows the same cards on a phone.
- **Jobs → Pipeline → Collections header** — the {{button:outline|⏱ Lien desk}} button beside {{button:outline|⚖ Legal}}, with the count.
- **Jobs → Pipeline → ⋯ Pipeline tools**, and the section hamburger's **Collections** group.
- A forecast row's **Send notice…** opens the desk on that job.

## The piles

Every job with a GC, money open, and an unpaid work month closing within 30 days is one row. The pills at the top are the piles:

- {{chip:yellow|Needs the owner}} — no owner of record with a mailing address is on file. The statute sends the notice to the owner, so this comes first. The pane looks the property up on the county appraisal roll as it opens and shows the answer in place under gate 1, laid out the way the envelope will read — the owner, a *c/o* line when the roll names one (the districts write it as a leading **%**), the street, then the city — under a caption with the district, the tax year and the CAD link. Anything the office should know sits below it ({{chip:yellow|landlord · ATI Schertz is the tenant}}, {{chip:red|public owner — bond claim, not a lien}}, or a plain line when the mail goes somewhere other than the job site, which is normal for a company-held property). {{button:blue|Use this owner}} saves it on the property record and moves the row to *To draft* on its own. {{button:outline|Find the owner ›}} (Edit Job → Property record, with the paste box) stays as the fallback and is all you get when the roll cannot place the address.
- **A public owner is never drafted.** When the owner of record is a city, county, school district, the State or another public body, the pane reads *Public property — a mechanic's lien does not attach; the remedy is a claim on the GC's payment bond. Talk to the attorney.* and the send buttons stay off. Saving the owner is still right — it is how the desk knows.
- **From the roll · unconfirmed.** When Settings → Jobs & billing → *Save owners from the appraisal roll automatically* is on, the app fills empty owners overnight without anyone pressing Use. The pane says so — *Owner from the roll (2025) · unconfirmed · confirm on Guadalupe CAD ↗* {{button:blue|Confirm}}. You can draft and send for approval on it, but **Record the run refuses** while any notice in the run carries an unconfirmed owner: open the CAD link, check the name, press Confirm.
- {{chip:gray|To draft}} — ready for the office.
- {{chip:blue|Awaiting approval}} — with the master.
- {{chip:green|Ready to send}} — approved; go out from the Lien window.
- {{chip:gray|Held}} — the master is waiting on a promise or a call; the desk asks again three days before the deadline.
- {{chip:gray|Sent · 30d}} and {{chip:red|Missed}} — the record, kept in sight.

## Drafting a notice

Pick the row. The pane shows what has to be true before it can go out, the **months this notice names** (every open month is ticked; one notice may carry several, and the earliest sets the deadline), the crew's hours behind each month, and the notice itself — the same document the Lien window prints, filled from the same job. **Send** lists who gets it (the owner of record and the GC, certified mail, with a courtesy PDF by email when the GC has one) and the optional cover note that says this is routine paper, not a claim of default.

- {{button:blue|Send for approval ▸}} sends it to the master. The footer says why it goes to him: no standing rule yet, the first notice we have ever sent this GC, they promised a payment date, or he held this GC before.
- **A "send" rule starts with the second notice.** Even when a GC's standing rule is *Send notices without asking*, the first notice we have ever sent that GC comes to the master. The office proves the owner of record, the mailing addresses and the GC's copy on real mail once; from the next month on the button reads {{button:blue|Put it in the run ▸}} and nobody is asked. The footer says which case you are in.
- {{button:amber|The leader said to send it ▸}} is for when he already told you in the truck: type who said it and when, pick phone, in person or text, and it goes straight to Ready to send. He sees it in his **Sent on your word** list with a *Not what I said* that pulls it back while it has not gone out.
- **Skip these months…** gives the lien right on those months up, on purpose, with a reason kept on the record.

:::example One call, one rule
Robert opens J650 in Awaiting approval: $33,500 open with Loberg Contracting, first notice we have sent them, no promise on file, June closes tomorrow. He ticks **Send notices without asking** under *Standing rule for Loberg Contracting* and clicks {{button:green|Approve & next ▸}}. From now on Loberg's months go to Ready to send by themselves; he still sees every send in his list, and a live promise always comes back to him.
:::

## Reading the notice before it goes

The pane is what goes in the envelope, page by page: the **cover note** as page 1 while its box is ticked in the footer (untick it and the page leaves), then the **notice** — the job's unpaid invoice follows it in the packet. Under the job's line sit the four gates — **1** owner of record, **2** original contractor, **3** property kind, **4** approved hours, always in that order — under a headline that says {{chip:red|✗ Can't go out yet}} or {{chip:green|✓ Ready to go out}}. A red gate is a *blocker*: the notice cannot go until it is fixed, and its door sits right under it, numbered to match. An amber gate is only *to check* — an unknown property kind moves the deadline, it does not stop the send. Then come the **months** with the claim beside them, and one **Wording** line; the notice itself takes the rest and scrolls with the pane. Once you scroll into it, a one-line strip stays pinned at the top — the same headline with any gate that is not clear, the months, the claim, and {{button:outline|Show gates ▴}} — so the facts are one glance away while you read.

{{button:outline|Preview in a new window ↗}} opens the notice as the packet prints it, in its own tab, with the values marked: {{chip:yellow|yellow}} means you can change it on the desk, {{chip:blue|blue}} means it is filled from the job — the date, the GC, the claim amount, the claimant — and is changed at its source, where the desk's rule for the demand letter holds: fix it there and the paper re-reads it. Everything else is the statute's form and prints as shown; the marks never print. Click a yellow value and the desk opens **Wording** on that field.

**Wording** holds the four values you may change: the type of labor or materials (the default says plumbing — an electrical job says so here), the project description, the party contracted with if different from the GC, and the contact person who signs. The line reads *Wording · standard* until something differs, then *Wording · edited (1) by Taunya*; the leader sees the same line under *What you're deciding*, so an edited notice never reaches approval unannounced. {{button:outline|Back to the job's wording}} puts the defaults back.

## The master's decisions

The desk shows him only what needs a decision: what is open with that GC, their word, the months and hours, and what a hold costs — *June's lien right ends September 15*. He can {{button:green|Approve & next}}, **Hold — they promised…** (asks again on the promise date), **Hold — I'll call first** (asks again three days before the deadline), or send it **Back to the office**.

## Sending the run

Approved notices go out together. {{button:blue|Send the run · N}} in the desk's header opens the run: one row per recipient — the owner of record and the original contractor for each notice — with the delivery method (certified mail by default; courier, hand, or a courtesy email where an address is on file) and a box for the tracking number.

1. {{button:outline|Print the packet}} — one document: a cover sheet listing every envelope with a blank for its tracking number, then each notice twice, *Copy for: Owner of record* and *Copy for: Original contractor*, with the cover note on its own page when the draft asked for it, and the job's unpaid invoice behind each copy (the statute lets the notice include it; the emailed copies carry it too).
2. Mail them. Type the tracking numbers when you are back, or leave them for later.
3. {{button:blue|Record the run ▸}} — each notice is written to its job naming **every month it covered**, the courtesy emails go out, and the desk rows move to **Sent**. The forecast's month lines read *notice sent* the moment it saves.

:::example One notice on its own
A ready item's footer also offers **Just this one, from the Lien window ›** — the § 53.056 tab with the desk's months filled in, for a single notice you want to print or email by hand. Recording it there moves the desk row too.
:::

## Affidavits

The notice preserves a month; the **affidavit** is the lien. Its window is one date per job — the 15th of the fourth month after the last month worked (the third on a residential property). The desk's **Affidavits** switch lists every unpaid job whose window closes within 30 days:

- {{chip:yellow|Needs the property facts}} — the affidavit's gate: owner of record, county and legal description on the property record, a recorded § 53.056 notice on a job with a GC, and not a homestead (a homestead lien needs a recorded pre-work contract — attorney territory). Each missing fact has its door.
- The same flow as notices: {{button:blue|Send for approval ▸}} or **The leader said to file it ▸**; the master approves, holds, or sends it back.
- {{chip:green|Ready to file}} — {{button:blue|Open the affidavit tab ›}} lands in the Lien window: print for notarization, sign before a notary, file it with the County Clerk, then **Record filing…** with the recording number. Recording it moves the row to **Filed**; a copy must reach the owner and the contractor within five days, and the Lien window records that too.
- A filed affidavit that is still unpaid says so and offers **Refer to the Legal desk ›**.

The Dashboard's *lien filing window closes* card opens the desk here.

## A GC in trouble

When one GC stops paying everywhere at once, the desk's one-month-at-a-time queue is too slow. **Put a GC on notice** sends the § 53.056 notice to the owner of every job with unpaid work under that GC — billed or still working — naming every unnoticed month, in one run. Three doors, all opening the same modal with the GC already picked:

- **Jobs → Pipeline → ⋯ Pipeline tools**, with the board filtered to a GC: {{button:amber|⚠ Put <GC> on notice…}} right under Lien desk.
- **The Lien desk header**: {{button:amber|⚠ Put a GC on notice…}} opens a picker of the GCs on the desk, most open first.
- **Bids → Customer review**: {{button:amber|⚠ Put on notice…}} beside *set terms…* on the GC's row.

The modal goes in the order the work does. A bar of the four steps stays pinned at the top as you scroll — **1 Owners · 2 Claims · 3 Cover letter · 4 Decision**, each with its live status (*6 of 6 on file*, *6 notices · $54,850*) — it lights the step you are in, and a click jumps to one. Above the steps, one summary says the money once: what is open with the GC, split into what is on bills and what is not yet billed, beside their word, the standing rule, the terms, the Legal desk and the next window to close.

1. **The owners.** The app looks every property without an owner up on the appraisal roll as the modal opens. Each row shows the roll's answer — owner, mailing address, what it reads as, the CAD link — and {{button:blue|Use}} saves it; {{button:green|Use all found · N ▸}} takes every found row at once. A miss offers *Find the owner ›* or a typed owner and mailing address. A public owner (a city, a school district) is {{chip:red|public owner — bond claim, not a lien}} and left out of the run. Rows that want someone come first. Once every job has its owner the step folds to one green line — *Show the N owners ▾* opens it again.
2. **What each notice claims.** Every month with approved hours and no live notice. The windows still open carry the color, each with its date and the days left ({{chip:blue|Jul by Oct 15 · 24 days}}; red inside a week); a month whose window has passed sits in the quiet column beside them, named as information — its lien is gone, the owner still learns the balance. The last row totals the table. If a job's property kind is not set, one line above the table says so — commercial dates are shown, a residential property is due a month earlier — and *set it ›* on the job's row opens Edit Job. A job that is not billed yet claims its contract balance, says so with {{chip:yellow|unbilled · contract balance}}, and offers *Bill the finished work first ›*. The affidavit date sits beside each row.
3. **The cover letter, written once for all.** A plain letter to the owners who paid the GC in good faith — what happened, what § 53.081 lets them do, that we release the moment we are paid, and the offer to be paid directly. Edit it once; `{{property}}`, `{{months}}` and `{{job}}` fill per notice. It prints as the first page of every owner's copy (the GC's copy carries the form only). Untick *Include the cover letter* to send the standard cover note instead. The § 53.081 paragraph prints as written until the attorney replaces it.
4. **The decision, once.** Why now (kept on every notice's record and on the GC), and three ticks, each a row that shows what it changes — *Standing rule: ask each time → send without asking* (it starts the moment this run is recorded — this run is the first notice, approved by the master), *Payment terms: Standard → Winding down*, and a Legal desk matter with every job. A value already there reads {{chip:gray|already set}}.

Then the footer says what the run takes — *2 ready now · 5 more the moment Use all found is pressed · 1 waits on an owner · 1 left out (public owner)* — and the buttons follow the role:

- {{button:green|Approve all N and send the run ▸}} — dev, master technician. Every ready job's desk item is approved, the ticks apply, and the run opens with the notices, two envelopes each.
- {{button:outline|The leader said to send them…}} — assistant, controller, dev: who said it, when and how, then every notice goes to Ready to send on his word.
- {{button:blue|Send all N to the leader ▸}} — the office prepares Steps 1–3 and the master gets **one card** on his Dashboard (and Quickfill): {{chip:blue|Approve the run for Harborline Builders · 7}} with the reason and the claimed total. It opens the same modal on his phone; {{button:green|Approve all 7 and send the run ▸}} takes the set and applies the ticks. The office then sees {{button:blue|Send the run · 7}} on the desk and prints it.

:::example Nine jobs, one Tuesday
Taunya hears from Harborline's bookkeeper that the Harbor Ridge draw went to another job. She filters the Pipeline to Harborline, opens ⋯ → Put Harborline on notice. Six of nine owners are missing; the roll finds five, she presses Use all found, and types the sixth from the plat. One job is the city's fire station — excluded, bond claim. She picks *GC is not paying its subs*, writes what she heard, ticks the rule, Winding down and the Legal desk, and presses Send all 7 to the leader. Robert approves from his phone; the office prints the run.
:::

Nothing is mailed or recorded until *Record the run* — the same run as always. Afterwards the GC's row on **Bids → Customer review** reads {{chip:red|on notice since Sep 15 · 7}} beside its terms, and the desk's Affidavits pile carries the same jobs with their windows.

## Who can do what

- **Draft, send for approval, send on the leader's word, skip:** dev, assistant, controller (a master can draft and approve his own).
- **Approve, hold, set a standing rule:** dev, master technician. The database refuses an approval from anyone else, and a spoken-word send without a note.
- **Put a GC on notice:** the office opens it and readies the owners; Approve all is the master's or dev's; the spoken-word send is the assistant's, controller's or dev's.
