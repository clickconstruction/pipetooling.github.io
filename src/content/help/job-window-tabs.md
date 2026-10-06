---
title: move between a job's Job, Edit, Bill, and Costs tabs
category: Office
roles: dev, master_technician, assistant, controller
keywords: job window, tabs, phone, action bar, status sheet, next verb, arrived, leaving, costs, cost timeline, parts cost, team labor, history, day grid, days worked, job detail, edit job, billing, bill tab, invoices, payments, line items, one window
order: 65
---
A job now opens as one window with six tabs. No more separate Job Detail and Edit Job modals bounce you between each other.

The window is **one window with six tabs**. One **✕** closes the whole thing. **Escape** closes it too. On a phone the window fills the screen. The tabs wrap to fit. The **✕** sits at the top right.

Under the tab bar, **every tab** shows the same job header. It holds the job name and the action icons. The icons are share, supply house, send as task, calendar, mail, 📝 write up a change, and ⚙. The 📝 shows only for people who switched *Write up a change from the field* on in Settings. The header also holds the **Street View photo** with the 📍 map link. The icons work from any tab. You open the job calendar while billing. You share the job while editing. The address stays one glance away. So you always know which house you are on. The **supply house** storefront icon turns **teal** once a job-account packet has gone out for this job. You hover it to see who got it and when. You click it for the history or to resend. See [share a job with a supply house](?g=share-job-with-supply-house).

## On a phone: the bar at the bottom

On a phone the window carries a bar under the body. The bar stays put while you scroll. It reads {{button:outline|Status ▾}} {{button:blue|Ready to bill}} {{button:outline|Note}}. The middle button is **the job's next move**. It is the same thing its Pipeline row flags. It reads {{button:red|Set % done}} when a bill went out with no progress recorded. It reads {{button:green|Bill it}} when a draw is ready. A draw is one bill for part of the job. It reads **Send bill…** when a draft is waiting. Otherwise it reads **Move to Working**, **Ready to bill** or **Mark paid**. You tap **Status ▾**. It opens the Edit tab's status rail in a sheet. You tap the next stage. A move that needs a reason, a bill line or a payment asks for it there. **Note** jumps to the note box.

The status shows as a chip beside the job's name. ***Job total · Billed · Paid*** sit under the customer. The street view photo waits behind a *street view ▸* link. **Arrived** and **Leaving** appear only for people on the job's crew.

## The six tabs

- {{chip:blue|Job}} is the read view. It shows the photo and address, the customer and contacts, and the **Job accounts** line. That line reads *Ferguson ✓ · Reece none yet*. You tap a chip for what to say at the counter or to ask the office. See *open a job account before buying parts*. The tab also shows the numbered activity feed, the work and bill dates, and a compact **Costs** card. The card has one line each for team labor, sub labor, parts, and margin. You tap it to open the Costs tab. This is where "open job detail" lands.
- {{chip:blue|Edit}} is the job itself: numbers, name, address, service type, and the people-and-customer rows below. The row's ✎ Edit button lands here. So does the ⚙ on the Job tab.
- {{chip:blue|Bill}} is money **in**. The **Line Items** sit right at the top. They are the job's scope and Job Total. Then comes **② Bills and payments**. Its money card says what is done, paid, billed and left. It gives each line a row with where its money stands. **Make a bill** follows while money is left. Then come the bills, each with the payments that paid it. A saved payment that landed on the wrong job has {{button:outline|Move to job…}}. You pick the right job. You read both jobs' paid and open before and after. You say why. The payment moves with its date, amount and bank link. A payment a sent bill already counted asks you to unlink it from that bill first. Both jobs keep a grey trace line under the table. A supply house **job account** may be on file for the job. Then a teal note sits just above Invoices. It says who holds it and when the packet went out. It flags any unpaid supplier invoices on the account. See *mark an invoice as on a job account*.
- {{chip:blue|Costs}} is money **out**, told straight. Four numbers come first. They are **true margin at completion**, **spent so far**, **earned so far** and **time left**. Earned so far is % done × the price. Then come the baseline strip and one chart. Owners, controllers and master techs see the chart. See *read the cost and value timeline on a job*. Then **Where the money went** shows each source's share. It sits above the parts accordions. Those are supply house invoices, card charges, parts from tally, and other job charges with **+ Add other charge**. **Card charges** counts what the job cost, the same way Job Summary does. An Internal Transfer is not a cost. A card charge that is also on a supply-house invoice is counted once, under the invoice. Those lines still show in the list. Each has a grey note saying why it is not in the total. **Fuel gets its own line**. It sits on the Job tab's Costs card under Parts. In **Where the money went** it is ⛽ **Fuel & gas** beside **Other card charges**. The total does not change. The fuel is just no longer hidden inside Parts. A card charge counts as fuel when its accounting label is in the Fuel & gas tag. With no label, it counts when the bank filed it under fuel. Each one carries a ⛽ marker in the card charges list. Any other tag the office marks *show as a cost line* gets a line the same way. The daily spend and the Cost Timeline sit behind ***Show the timeline · daily spend***. Everything that used to sit at the bottom of Bill lives here now.

- {{chip:blue|History}} is the day grid. It has one row per day worked, coloured by how many people were on site. It is the same view Projects → Job History shows. Now it is there for every job, project or not.

- {{chip:blue|Documents}} is the job's paperwork. It lists the job's pay applications, each with its number, its period and the payment due. You press **Open the file** to see the file that was sent. You press **Open** to change the application. See *fill out an AIA G702-G703*. Under them come the job's **Bills**. You press a bill's name to open it, or **PDF** to get the invoice in a new tab. Then comes the job's **Contract**. A signed contract opens the Contract window. Then come the job's **Test reports**. A sent report opens the PDF the GC received. A draft opens the Test report window. Then comes the job's **Lien paper**. That is its lien notices, demand letters and releases of lien. A release opens the page as it was signed. A notice or a letter opens the Lien window. The tab ends with the job's folders.

## Where is the team labor number?

Owners, controllers and master techs see **Team labor** as the first line of the Job tab's Costs card. It is also the first row of the cost block on the **Costs** tab. It shows the total, then *8.0 h · Malachi* or *277.5 h · 7 people* under it. You tap it for the per-person split. That row is the same number the Cost Timeline's 👷 markers add up to. It is the same one Job Summary's **Labor** column shows. So the three always agree. A salaried day counts as 8 h on whichever job the person was clocked to. Hourly people count their recorded session hours. Other roles see just the Parts line on the card. They see the block as **Parts Cost** on the Costs tab, without the row. The dollars come from wages.

## The History tab

The job may still owe money. Or a lien paper or demand letter may be out. Then **History** shows the job's **lien timeline** above the grid. A lien is a legal claim on the property for unpaid work. The timeline lists every deadline in order and whose move it is. It shows the demand letter with its reply-by day, and a *Waiting on* line. It is the same strip the Lien window's header draws. On this tab it is the calendar. The verdict sits first in a tinted band. Every window is drawn, the closed ones too. See *send lien notices from the Lien desk* → *Where a job stands*. **History** looks back 180 days by default. You move the range to see more. You tap a day to see who was there and what it cost. Nothing on this tab edits anything. On a phone the grid becomes a list. It has one row per day worked, newest first, with the names and the people count. A one-line gap shows where days went by with no work. You tap a row for the same day detail. Above it, one bar holds the range. It has the dates and the {{chip:blue|90d}} {{chip:gray|180d}} {{chip:gray|365d}} presets. It has a line with the days worked and the most people on site. You tap **Edit** for the date pickers. Picking a preset puts them away.

## The Edit tab reads as rows

The middle of the Edit tab is a compact list. Its rows are **Account man, Team, Customer, Phone, Email, GC/Builder, Date met, Folders, Project, Plans, Bid, Development**. GC means the general contractor. Each row shows the current value at a glance, with a *—* where nothing is set. You tap a row or its ✎ to open the familiar editor for just that field. You tap again to fold it away. The **Folders** and **Plans** rows keep their Drive links clickable right on the row. So opening the customer's files never requires expanding anything.

:::example Fixing a phone number
Edit tab → tap the **Phone** row → retype the number → tap the row again to fold it. Autosave takes it from there.
:::

## Things worth knowing

- **Switching tabs never loses work.** You type half a job name. You hop to Bill to check the remaining amount. You come back. Your keystrokes are still there. Autosave keeps running throughout. See *know when Edit Job saves my changes*.
- Edits you make on the Edit or Bill tab show up on the Job tab right away. It refreshes itself after each save.
- {{button:red|Delete}} lives at the bottom of the **Edit** tab only. Its confirm rounds team labor to a readable figure, such as "≈ 22.8 hrs". It points a dev to **Settings → Data & recovery → Recently deleted** for the 90-day restore.
- Creating a **new** job still uses the plain New Job form. A job with nothing to read or bill yet does not need tabs. If you have typed anything, Cancel, Escape or clicking outside asks **Discard this job?** first. An untouched form just closes. Escape closes only the window on top. So a New Job opened from a bid never takes the bid window with it.

:::example A billing round-trip
Open the job → **Bill** tab → **Make a bill** → **Bill part of it** → drag the slider to 80% → **Make a bill** → hop to **Job** to confirm the billed bar moved. One window the whole time.
:::

:::example Checking margin before you bill
Open the job → glance at the **Costs** card on the Job tab → tap it → the **Costs** tab shows the Cost Timeline and every bucket → back to **Bill** to write the draw.
:::

Field roles, Sub and Helper, keep the simple read-only Job Detail view they have always had.
