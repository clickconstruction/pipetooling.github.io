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

## Ask for it sooner

The robot icon on the Bid Board still puts a bid at the front of the line — click it when you want the shadow first. The sealed number shows up on your Dashboard as {{chip:blue|Robot bid}}, and the score lands the moment you mark the bid sent.
