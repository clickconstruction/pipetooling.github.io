---
title: let the robots shadow a bid
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator
keywords: robot, twin, shadow, plans link, drive, intake account, share, readiness, opt out, distance to office
---
Every plumbing bid you create gets a **robot shadow estimate** by default: within the hour a robot reads the plans, counts, prices, and seals its number before yours goes out. You never see it until you send. The bid form tells you whether that will happen.

## Read the line under Job Plans

1. Paste the plans link (a Drive file or folder). The line checks it as you go:
   - {{chip:green|Robots will shadow this bid within the hour}} — with what it verified: folder shared · 3 PDFs, plumbing, miles, due date. Nothing more to do.
   - {{chip:yellow|Robots can’t open these plans yet}} — the file isn’t shared with the robots’ intake account. Hit {{button:gray|Copy intake address}}, share the file with that address as **Viewer** in Drive, then {{button:gray|↻ Check again}}. The line turns green without leaving the form.
   - {{chip:yellow|Robots don’t bid this division}} — robots estimate plumbing only; an electrical or HVAC bid is simply left alone.
2. A blank **Distance to Office** is filled in when you save, as long as the bid has an address. With no address the robot asks before pricing travel.

:::example Folders are fine
You don’t have to link the PDF itself. Link the job’s plans folder and the robots merge every PDF in it into one set.
:::

## Keep a bid away from the robots

Tick **Don’t let robots shadow this bid** under the line. The bid leaves the robot queue and the coverage count, and its robot icon on the Bid Board goes grey. Untick it any time to put it back.

## Watch it on the Bid Board

The robot icon beside the bid number says how the shadow is going — nobody has to ask for one:

- **Outline robot** — queued for the next batch. **Solid robot** — reading the plans and counting. **Lock badge** — it sealed its number; nobody sees that number until you send. Click any of these for the robot's timeline.
- **Amber robot with a ?** (or a number) — the robot needs something from you: plans it can't open, a different plan set, or a question it asked. Click it: the sheet lists each gap with the fix, offers {{button:gray|Copy intake address}} when the plans aren't shared, and lets you answer the robot's questions right there. When the robot says the wrong set is on the bid, that ask sits up with the gaps, with {{button:gray|Edit bid}} beside it; fix the plans link, then tap {{button:blue|★ Attached — rerun}} and the robot goes again on its next run.
- **Green ✓ badge** — you sent the bid and the robot's sealed number was scored against yours. Hover for how far off it was; click to compare counts and pricing.
- **Muted robot** — this bid is opted out, or it's a division robots don't bid yet.

Tap the small **?** beside the **Bid #** header (on a phone, beside the trade chip in the pill row) for the full key, including the A–X grades a sent or decided bid wears.

## Ask for it sooner

Open the robot's timeline from the icon and tap {{button:outline-blue|Front of the line next batch}} — the next batch takes that bid first. The sealed number shows up on your Dashboard as {{chip:blue|Robot bid}}, and the score lands the moment you mark the bid sent.
