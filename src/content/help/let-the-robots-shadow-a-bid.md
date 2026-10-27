---
title: let the robots shadow a bid
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: robot, twin, shadow, plans link, drive, intake account, share, readiness, opt out, distance to office
where: /bids
---
Every plumbing bid you create gets a robot shadow estimate by default. A robot reads the plans, counts, prices and seals its number before yours goes out.

The robot starts within the hour. You never see its number until you send. The bid form tells you whether that will happen.

## Put the plans in the bid folder

Plans are always a Drive link, never an upload. The **Plans** block sits right under the project name. It walks you through four cards. You click {{button:outline|Open in Drive ↗}} to open the division bid folder. There is one folder each for plumbing, electrical and HVAC, the heating and cooling trade. The service type says which one opens. **Make a folder with this name** shows the name the office gives it, which is the project name. You copy it with {{button:outline|Copy name}}. You put the PDFs in that folder. Then you click {{button:blue|Find the folder}}. It looks the folder up by that name and fills the plans link in. You never copy a link. Plans that live somewhere else in Drive go in with {{button:outline|Paste a link instead}}.

## Read the line under it

1. With the link filled in, the line checks it as you go:
   - {{chip:green|Robots will shadow this bid within the hour}} shows with what it verified. That is folder shared, 3 PDFs, plumbing, miles and due date. Nothing more to do.
   - {{chip:yellow|Robots can’t open these plans yet}} means the robots cannot reach a pasted link. A link outside the bid folders is not shared with the robots’ Drive account. You click {{button:gray|Copy the robots’ address}}. You share the folder with that address as **Viewer** in Drive. Then you click {{button:gray|↻ Check again}}. A folder made inside the division bid folders never needs this.
   - {{chip:yellow|Robots don’t bid this division}} means robots estimate plumbing only. An electrical or HVAC bid is simply left alone.
2. A blank **Distance to Office** is filled in when you save, as long as the bid has an address. With no address the robot asks before pricing travel.

:::example Folders are fine
You don’t have to link the PDF itself. Link the job’s plans folder and the robots merge every PDF in it into one set.
:::

## Keep a bid away from the robots

You tick **Don’t let robots shadow this bid** under the line. The bid leaves the robot queue and the coverage count. The bid's robot icon on the Bid Board becomes a dashed ring with the word *you* in it. You untick it any time to put it back. You can also tap that mark on the board and press {{button:blue|Let the robot back in}}.

## Watch it on the Bid Board

The robot icon beside the bid number says how the shadow is going. Nobody has to ask for one. You click the {{icon:help|?}} beside the **Bid #** header to open the key. The key lists every state below. It also gives a thirty-second answer to *why can't I see the robot's number*. The robot bids in secret and seals its price in an envelope. The envelope opens when you send. Close enough often enough earns it first drafts, the first pass at our bids.

- **Outline robot** means the bid is queued for the next batch. **Solid robot** means it is reading the plans and counting. **Lock badge** means it sealed its number. Nobody sees that number until you send. You click any of these for the robot's timeline.
- **Amber robot with a ?** or a number means the robot needs something from you. It may be plans it can't open, a different plan set, or a question it asked. You click it. The sheet lists each gap with the fix. It offers {{button:gray|Copy intake address}} when the plans aren't shared. It lets you answer the robot's questions right there. Every {{button:gray|Edit bid}} on it opens the form on the field that gap is fixed on. That field is Job Plans, the GC, the service type or the due date. The GC is the general contractor. When the robot says the wrong set is on the bid, that ask sits up with the gaps. It has {{button:gray|Edit bid}} beside it. You fix the plans link, then tap {{button:blue|★ Attached — rerun}}. That one tap answers the robot. It moves the bid to the front of the next robot batch. That is the same as asking with the green robot icon.
- **Green ✓ badge** means you sent the bid and the robot's sealed number was scored against yours. You hover for how far off it was. You click to compare counts and pricing.
- **Muted robot** means a division robots don't bid yet.
- **A dashed ring with you in it** means the bid is left to you. No robot touches it. You tap it to let the robot back in.

You tap the small **?** beside the **Bid #** header for the full key. On a phone it sits beside the trade chip in the pill row. The key includes the A to X grades a sent or decided bid wears.

## See where the robot is

The robot icon is a ring of seven segments, one per step. The steps are picked up, plans filed, reading the sheets, counting, pricing, sealed, and questions for you. A segment fills when the robot passes that step. The segment it is on fills by the sheets it has read. So a glance says third of seven. You hover the icon and it says the step in words, with when the robot last spoke.

You tap the icon for the sheet. The sheet draws the same seven steps as a bar. The lit step says what is inside it, like 12 of 31 sheets. Under the bar it says when the robot last spoke and which Mac it spoke from. Once ten runs have finished, it also says how long most bids take.

You press {{button:blue|Read the run}} to see every signal the robot sent on this bid, oldest first. You press {{button:gray|Leave this one to me}} to take the bid off the robots. The robot stops within five minutes and sets its copy aside.

After that the card shows a dashed ring with the word *you* in it. The mark means the bid is left to you. No robot touches it. You tap the mark to open its sheet. You press {{button:blue|Let the robot back in}} to put the bid back. The next round may claim it again. The tick **Don’t let robots shadow this bid** on the bid form shows the same mark.

A sent bid shows the ring too while a robot works on it. A round sometimes shadows a bid you already sent. You tap the icon to compare its counts and pricing with yours. The window says where the robot is. You press {{button:gray|Read the run}} there to see every signal the robot sent.

The first time you open the sheet, a short note says what the robot touches. The robot reads the plans and works on its own copy of the bid. It never edits your bid. It never sends anything to anyone. Its number stays sealed until you send yours.

If no robot has spoken on a bid for ten minutes, the ring turns amber. The sheet says the robot went quiet and when. Another round picks the bid up within ten minutes. You do not need to do anything.

## Ask for it sooner

You open the robot's timeline from the icon and tap {{button:outline-blue|Front of the line next batch}}. The next batch takes that bid first. The sealed number shows up on your Dashboard as {{chip:blue|Robot bid}}. The score lands the moment you mark the bid sent. The envelope opens for you right then. See [review the robot's number when you send](?g=review-the-robots-number-when-you-send).

## The Robot Board: our bids, through the robots

**Bids → 🤖 Robots → Robot Board** is not a second board. It lists **our** bids in the same sections as the Bid Board. Those are Unsent / Working, Not yet won or lost, Won, Started and Lost. It adds a robot column:

- Before we send, the column shows {{chip:gray|sealed}}, {{chip:gray|queued}} or {{chip:gray|estimating}}. No number, ever. A sealed row names whose number it will score against. The words *practice teacher* mean the run is shown but never counts toward first drafts.
- A live bid the robot **can't start on** shows amber, like its icon on the Bid Board. The row says *No plans link*, *Plans aren't shared with the robots*, or *2 questions*. Under it sit the fix and one door. You click {{button:outline-blue|Paste the plans →}} to open Edit bid on the **Job Plans** field. You paste the link and save. Done. You click {{button:outline-blue|Share the plans →}} or {{button:outline-blue|Answer →}} to open the robot's needs sheet. That sheet has the intake address to copy and the robot's taps. Its {{button:gray|Edit bid}} buttons land on the field each gap is fixed on. The section header counts them: *7 need a person before a robot can start · five minutes each*. Every one you clear is a free practice run.
- After we send, the row shows the robot's number, ours, and the delta, the gap between them. The delta is green within 8%. The run is named, as *shadow b482*, *backtest R2* or *vs Wendi*. A bid the robots ran twice leads with the newest run. You tap **where the delta lives** under the project name for the split. The split is missed, added, counts and priced differently. It also shows the robot's own note on what it was least sure of.
- A bid you marked sent **without a value** shows {{chip:gray|sealed}} with *no bid value on record*. It has an {{button:outline-blue|Add bid value →}} door. The robot's number scores the moment the value is on the record.
- Doors on the row: {{button:outline-blue|Review now}} opens the envelope while the audit waits. The other doors are {{button:gray|Open audit}}, {{button:gray|Compare}} for counts and pricing, and {{button:gray|Robot status}} on a live row. {{button:gray|Robot bid b418}} opens the robot's own copy.

The strip under the ***Robot Board · Audits · Scoreboard*** bar is the program in six plain numbers. They are bids with a robot run, live plumbing bids shadowed, and sealed numbers waiting on you to send. Then bids that need something from a person, audits waiting, and kinds of job that have earned first drafts. It heads every lens in the group. A lens is one of the views under Bids → 🤖 Robots. Each tile opens the lens that works it. *audits waiting* opens Audits, and *kinds of job* opens the Scoreboard.
