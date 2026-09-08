---
title: turn a won bid into a job
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: won, win, bid, job, scheduled visits, move visits, schedule blocks, open the job, convert, import, new job, J number, opened from this bid, cancel import, which GC gave you this job
order: 72
---
The one sentence: **wherever you mark a bid Won, "Open the job" is right there** — one tap opens New Job with the customer, address, plans and folder filled in and the bid linked on the job.

## The moment you win

Every place a win gets recorded offers the same door:

- **Edit Bid → Win / Loss.** Click {{chip:green|Won}} — the bid saves it on its own (the Edit tab saves as you go) — and the **Job** block under it turns green: {{button:green|Open the job}}. It works on any saved bid — even one still marked Open — it is just quieter then.
- **Bid Board → GC lines.** On a bid sent to more than one GC, set the winner's pill to {{chip:green|won}}; a small **open the job →** link appears beside it.
- **Followup → Full bid details → Sent to — by GC.** Same pill, same link.
- **Followup → Waiting to hear.** Tap **Won** on the bid you are chasing. The bid leaves the queue and a green **You won it** strip stays at the top with {{button:green|Open the job}} until you use it or dismiss it.

:::example What comes over
B398 · Take 5 Seguin goes to Southern Post. Tap Won, then Open the job: New Job opens as *Take 5 Seguin*, at the bid's address, with Southern Post as the GC/Builder (name, phone, email, date met), the Project Folder and Job Plans links from the bid, and the bid chip set. Fill in the crew, press **Create Job**, and the job is born linked to the bid.
:::

## The price is offered, not assumed

When the bid carries a figure — its agreed value, or what the winning GC was sent — New Job asks one question before filling anything: **Start the job at $48,200?** {{button:blue|Carry $48,200 over}} puts it on the job as the first line item ("Bid price"), and if the bid had no agreed value yet, records it there too. {{button:outline|Start at $0}} leaves the Job Total empty and writes nothing — on the job or the bid. Either way you can change the number on the job any time.

What does **not** come over: the bid's own line items, schedule blocks, crew, dates.

## The bid shows its job

Once a job exists from a bid, the Job block in Edit Bid reads {{chip:green|J1007 opened from this bid}} with {{button:blue|Open the job}} beside it — that opens the job window. The Bid Board's **Links** column shows the same green **J1007** chip. So "did we already open this one?" has an answer on the bid itself.

And the job shows on the bid: the moment a job carries the bid, the bid's outcome moves to {{chip:blue|Started or complete}} by itself, and a toast names the bid for about five seconds as the job saves. That happens whichever door you came through — this button, **New Job → Import**, or a signed estimate — and bids that already had a job were caught up. Clearing the link later never clears the outcome; that stays a human call.

Need a second job from the same bid (a phase two, a split scope)? Press **Create another job**. New Job asks first — *A job already exists from this bid* — and **Create another job** goes ahead while **Cancel** leaves everything as it was.

## Visits scheduled on the bid

If dispatch had already put site visits on the calendar against the **bid**, they don't move on their own when the job opens. Once the job exists, Edit Bid's **Job** block adds a line under the chip:

:::example Visits still on the bid
{{chip:green|J1007 opened from this bid}} &nbsp; 2 scheduled visits still sit on the bid (1 upcoming). {{button:outline|Move them to J1007}}
:::

Tap it and confirm: the visits keep their crew, date and time and now read as the job's on the Schedule hub and the job's week; the bid's schedule reads empty. Nothing moves unless you tap — a visit that really was a bid visit can stay one. The button shows for the roles that edit the schedule (dev, leader, assistant, controller).

## Which GC gave you the job?

On a bid sent to more than one GC where no GC is marked won yet, Open the job asks **Which GC gave you this job?** The picker's own sentence is the confirm — it names the other GCs that will be marked *lost · GC lost the project*, and says so if the bid was marked Lost by hand and is about to flip to Won. Picking one records their Won and the job imports with that builder's details. If you tap **Cancel import**, nothing is written, a note says so, and the New Job form closes — no blank form left behind. See *bid one project to multiple GCs* for the full picker rules.

## Who sees the button

Dev, leaders, assistants, controllers, and **estimators** can open a job from a bid — estimators get the New Job form even though they do not have the Jobs page. Superintendents keep their read-only board and see no button. The **J####** chip that opens an existing job shows for the roles that can open Jobs (not estimators).

## Tips

- The other way in still works: Jobs → **New** → **Import** → pick the bid. It runs the exact same fill. Once you have typed anything on a New Job, **Import** greys out instead of disappearing — hover or tap it and it tells you to clear the form (or open a fresh New Job) first.
- The **C#** box reads *finding…* for a moment while New Job looks up the next number. If you already know the number, type it — the suggestion never overwrites what you typed.
- The Won you click in Edit Bid is on the bid a moment later (watch for *Saved* in the footer) — you no longer have to save the bid before opening the job.
