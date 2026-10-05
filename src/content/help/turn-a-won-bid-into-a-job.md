---
title: turn a won bid into a job
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: won, win, bid, job, scheduled visits, move visits, schedule blocks, open the job, convert, import, new job, J number, opened from this bid, cancel import, which GC gave you this job, ask dispatch, dispatch inbox, hand off, to-do
order: 72
---
The one sentence: **wherever you mark a bid Won, "Open the job" is right there**. One tap opens New Job with the customer, address, plans and folder filled in.

The bid comes linked on the job.

## The moment you win

Every place a win gets recorded offers the same door:

- **Edit Bid → Win / Loss.** You click {{chip:green|Won}}. The bid saves it on its own, since the Edit tab saves as you go. The **Job** block under it turns green: {{button:green|Open the job}}. It works on any saved bid, even one still marked Open. It is just quieter then.
- **Bid Board → GC lines.** On a bid sent to more than one GC, you set the winner's pill to {{chip:green|won}}. A GC is the general contractor. A small **open the job →** link appears beside it.
- ***Followup → Full bid details → Sent to — by GC.*** Same pill, same link.
- **Followup → Waiting to hear.** You tap **Won** on the bid you are chasing. The bid leaves the queue. A green **You won it** strip stays at the top with {{button:green|Open the job}}. It stays until you use it or dismiss it.

:::example What comes over
B398 · Take 5 Seguin goes to Southern Post. Tap Won, then Open the job: New Job opens as *Take 5 Seguin*, at the bid's address, with Southern Post as the GC/Builder (name, phone, email, date met), the Project Folder and Job Plans links from the bid, and the bid chip set. Fill in the crew, press **Create Job**, and the job is born linked to the bid.
:::

## The price is offered, not assumed

The bid may carry a figure: its agreed value, or what the winning GC was sent. Then New Job asks one question before filling anything: **Start the job at $48,200?** {{button:blue|Carry $48,200 over}} puts it on the job as the first line item, *Bid price*. If the bid had no agreed value yet, the figure is recorded there too. {{button:outline|Start at $0}} leaves the Job Total empty. It writes nothing on the job or the bid. Either way you can change the number on the job any time.

What does **not** come over: the bid's own line items, schedule blocks, crew, dates.

## Or hand it to Dispatch

Won it but not the one who sets up the crew? Beside {{button:green|Open the job}} there is a quieter {{button:outline|Ask Dispatch to open it}}. One press files a to-do in the **Dispatch inbox** with the bid attached. It reads *Open the job for B398 · ZZ Test — won with Southern Post*. Dispatch's phones get the usual push, a phone notification. The bid then shows {{chip:yellow|Dispatch asked · by Wendi · 2 min ago}} where the button was. So nobody asks twice.

:::example What Dispatch sees
On the Dashboard's Dispatch inbox (and Dispatch Mode → Inbox) the to-do carries one button: {{button:outline|Open the job}}. It opens New Job filled in from the bid exactly as it would from the bid itself — customer, address, links, the price question, and *which GC* on a multi-GC bid. Press **Create Job** and the to-do closes on its own: *J1007 opened from B398 · ZZ Test*, and you get the "Handled" push.
:::

- **Asked twice?** The app says *Dispatch already has this one* instead of stacking a second to-do.
- **Someone opened the job another way?** The inbox notices a job already carrying the bid and closes the to-do itself, noting *opened elsewhere*.
- **Primaries** can mark a bid Won but have no New Job form. A primary is the GC-side login. For them the hand-off is the only button. Marking Won in Edit Bid sends it to Dispatch automatically.

## The bid shows its job

Once a job exists from a bid, the Job block in Edit Bid reads {{chip:green|J1007 opened from this bid}}. {{button:blue|Open the job}} sits beside it and opens the job window. The Bid Board's **Links** column shows the same green **J1007** chip. So "did we already open this one?" has an answer on the bid itself.

And the job shows on the bid. The moment a job carries the bid, the bid's outcome moves to {{chip:blue|Started or complete}} by itself. A toast names the bid for about five seconds as the job saves. A toast is a small message that pops up. That happens whichever door you came through: this button, **New Job → Import**, or a signed estimate. Bids that already had a job were caught up. Clearing the link later never clears the outcome. That stays a human call.

Need a second job from the same bid, like a phase two or a split scope? You press **Create another job**. New Job asks first: *A job already exists from this bid*. **Create another job** goes ahead. **Cancel** leaves everything as it was.

## Visits scheduled on the bid

Dispatch may have already put site visits on the calendar against the **bid**. They don't move on their own when the job opens. Once the job exists, Edit Bid's **Job** block adds a line under the chip:

:::example Visits still on the bid
{{chip:green|J1007 opened from this bid}} &nbsp; 2 scheduled visits still sit on the bid (1 upcoming). {{button:outline|Move them to J1007}}
:::

You tap it and confirm. The visits keep their crew, date and time. They now read as the job's on the Schedule hub and the job's week. The bid's schedule reads empty. Nothing moves unless you tap. A visit that really was a bid visit can stay one. The button shows for the roles that edit the schedule: dev, leader, assistant and controller.

## Which GC gave you the job?

A bid may be sent to more than one GC with no GC marked won yet. Then Open the job asks **Which GC gave you this job?** The picker's own sentence is the confirm. It names the other GCs that will be marked *lost · GC lost the project*. It also says so if the bid was marked Lost by hand and is about to flip to Won. Picking one records their Won. The job imports with that builder's details. If you tap **Cancel import**, nothing is written and a note says so. The New Job form closes, with no blank form left behind. See *bid one project to multiple GCs* for the full picker rules.

## The submittals question

After the contract and job-accounts questions comes a third one, about submittals. A submittal is the product paperwork the GC approves before you install. The question reads ***Submittals for J964 · Pondhill?***

Rev 1, the first version, is built from what Pricing already knows on the bid. That is the fixture schedule and the products from the supply houses you picked. It also holds the reasons and lead times you gave at the pick. A lead time is how long a product takes to arrive. Each answer does something different:

- {{button:blue|Build Rev 1 from the picks}} builds it, links it to the job and opens the Submittals tab.
- {{button:outline|I have the vendor's PDF}} does the same and lands you where the PDF drops onto the rows.
- *Later* asks again from the Dashboard's Needs You card in five days.
- *Not needed on this job* quiets that card for good. The Submittals tab shows the answer with an undo.

Nobody is asked for the reviewer here. The reviewer turns up later in the GC's email chain. The Share button on the tab names them then. A bid that already has a submittal asks nothing. The job is simply linked to it.

## Who sees the button

Dev, leaders, assistants, controllers, and **estimators** can open a job from a bid. Estimators get the New Job form even though they do not have the Jobs page. Superintendents keep their read-only board and see no button. The **J####** chip that opens an existing job shows for the roles that can open Jobs. Estimators don't see it.

## Tips

- The other way in still works: Jobs → **New** → **Import** → pick the bid. It runs the exact same fill. Once you have typed anything on a New Job, **Import** greys out instead of disappearing. You hover or tap it, and it tells you to clear the form, or open a fresh New Job, first.
- The **C#** box reads *finding…* for a moment while New Job looks up the next number. If you already know the number, you type it. The suggestion never overwrites what you typed.
- The Won you click in Edit Bid is on the bid a moment later. You watch for *Saved* in the footer. You no longer have to save the bid before opening the job.
