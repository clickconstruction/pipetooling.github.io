---
title: read the bid board
category: Office
roles: dev, master_technician, assistant, estimator
keywords: reply book, GC, packet, won, lost, outcome, bid board, jump strip, sections, pending, lost, show all, bid dropdown, notes, due date, last contact, days late, google maps, phone cards, trade pill, counts, sent 1/2, call queue, chase, quiet, robots tab, undo won, matches by value, link, cost it, costed, budget
order: 68
---
The Bid Board shows every bid in five sections. It also shows Estimating Health at the bottom.

You open it at Bids → Bid Board. The sections are **Unsent / Working**, **Not yet won or lost**, **Won**, **Started or Complete**, and **Lost**. **Estimating Health** sits at the bottom.

## Jump between sections

Above the sections sits one tools row. It holds the search box and {{button:outline|Archived}}, the box icon with a count of archived bids. It holds {{button:outline|Reply book}}, wording the team reuses. See [reuse a reply the team has already written](?g=use-the-reply-book). It holds {{button:outline|Customer review}}. On a phone the last two are their icons.

A pill row stays pinned at the top of the board:

{{chip:gray|Plumbing}} {{chip:gray|Unsent 17}} {{chip:yellow|Pending 101}} {{chip:gray|Won 26}} {{chip:gray|Started 10}} {{chip:gray|Lost 114}} {{chip:gray|Health}}

You tap a pill to jump straight to that section. It opens automatically if it was collapsed. **Health** takes you to the Estimating Pulse at the bottom. Each pill shows the live bid count. **Pending** is highlighted because it is usually where the action is.

**The counts follow the trade pill, and the row says so.** The word at the front of the pill row names the trade every number on this page is for. It reads **Plumbing:**, **Electrical:** and so on, or **all trades:** when no pill is selected. You switch the trade pill and that word, the board and its counts switch together. **Every count is a count of bids**. A bid you sent to three GCs, general contractors, is one bid in Pending, not three. The GC lines under its row keep the per-GC detail. The lost-bids card on the **Dashboard** counts the whole company and says *· all trades* on its number. So *59 need a reason · Plumbing* here and *60 lost bids … · all trades* there are both right. The labels tell you which question each answers.

The two biggest sections, **Not yet won or lost** and **Lost**, start with their first 25 bids showing. You use {{button:outline-blue|Show all N ▾}} at the bottom of the list to see the rest. Search always looks through every bid either way.

**Not yet won or lost** lists the most recently sent bid first. A row with no sent date falls back to the bid date. So the freshest submissions are at the top while you wait for answers. Because the section sorts by sent date, every row prints it. A small {{chip:gray|sent Wed 9/2}} line sits under the Due chip, so the order reads as what it is. The other sections keep their due-date order, soonest first.

In **Unsent / Working**, a bid with no due date is never blank. It shows a dashed {{chip:gray|No due date (+N)}} chip. The chip counts its days on the board. It turns {{chip:red|No due date (+15)}} red after 14 days, so an undated bid cannot rot quietly. You give it a due date in Edit bid, or you archive it. To archive, you open the bid and press {{button:outline|Archive from board}} in the Edit Bid footer, beside Delete bid. The button is always there. It is greyed when it cannot act. That happens when the bid was sent. It happens when the bid is Won, Lost or Started. It happens when it is not yours to archive. Pressing the grey button tells you why and what to do instead. A sent bid that is dead gets marked Lost, not archived. On an archived bid the same button reads {{button:outline|Put back on board}}.

While the board is still fetching after you open it, you see **Loading bids…** with grey placeholder rows. It never shows a false *No bids yet*.

## Read a row

Each row leads with the bid number, flanked by **jump icons**. They are Counts, Takeoffs, Labor, Pricing, and Cover Letter, in the same order as the tabs across the top. You hover one to see its name. You click it to land on that tab for that bid, one click from the board. A thin **flow bar** runs under the icons. Green phases are done, blue is the next move, grey is not yet. You hover it for *7 of 9 done · next: Cover letter*. See [see where a bid is in the estimating flow](?g=see-where-a-bid-is-in-the-flow). The **Edit** gear sits on the number's right. A red badge next to the number means unread notes. Then:

- **Robot icon**: right before the bid number. On a live bid it says the robot is on it. Outline means queued. Solid means counting. 🔒 means its number is sealed until you send. Green ✓ means scored after you sent. In amber with a **?** or a count, it means the robot needs something from you. That is plans it cannot open or a question it asked. You click to fix or answer. On a sent or decided bid the icon wears a grade letter, **A** through **X**. The grade says how much a robot can learn from the record. The small **?** beside the **Bid #** header opens the full key. On a phone it sits beside the trade chip in the pill row. See [let the robots shadow a bid](?g=let-the-robots-shadow-a-bid).
- **Due Date**: a chip with the weekday and date on top and a signed day count under it. ***(+4)*** means four days past due. ***(-2)*** means due in two days. The red and amber colors appear **only on unsent bids**. Once a bid is sent, the chip goes quiet, because the wait is on the GC. Once it is decided the day count drops too. That quiet is on purpose. The board's colours are about getting the letter out the door. **Chasing a sent bid lives on the Followup tab**. Its **Call queue** ranks every builder by who has waited longest. It lists the pending bids nobody has talked to in over a week. See [follow up with builders on their bids](?g=follow-up-with-builders). Not sure what a color means? You tap the little red, yellow and grey key beside the **Due Date** header for the legend.
- **Last Contact**: the same two-line pattern. The date sits on top. ***(+6)*** means six days since you last touched the bid. You tap it to log a contact.
- **Links**: icons for only the artifacts the bid actually has. Those are the project folder, job plans, CountTooling plans, and the bid submission.
- **GC lines**: under a multi-GC bid, one line per GC. Each reads *sent date · state · name*. **You tap the name** to read and leave notes about that GC on this bid. A 💬 count shows who has notes. The state pill still sets won or lost.

Distance to the office lives in the row dropdown, along with the address. You tap the address there to open Google Maps.

In the **Lost** section, every bid carries a **Why did we lose?** strip. When the loss has a reason recorded, it reads the reason, category first, then what they said. When it does not, the strip says so. It reads *Add why: an uncategorized loss can't teach the robots*. It puts the **six reason chips right on the row**. So recording the reason is one tap without opening anything. A note on the bid may even pre-suggest a chip with an amber ring. An uncategorized loss gets left out of the robot estimators' training math. That is why the strip asks.

## Won rows: is the job linked, and was the bid costed?

On a won row the Links column carries two more chips. {{chip:yellow|J1007 matches by value · Link}} means a job carries this bid's value to the dollar. That job is not linked to it yet. You press **Link** and confirm. The job is stamped with the bid. The bid reads Started. The bid's estimate becomes the job's budget, and Burn on the job's Costs tab reads against it. The other chip reads the Cost Estimate tab. {{chip:green|costed · 47 h}} means hours and a labor rate. {{chip:yellow|hours only · 36 h}} means you set the rate. {{chip:red|no cost estimate · Cost it →}} opens the bid's Labor tab. A job made from the bid shows the usual {{chip:green|J1007}} chip instead of the match.

## Bids sent to more than one GC

A bid can have a packet per GC, a separate letter with its own counts and price. See *bid one project to multiple GCs*. Then its GC/Builder cell lists each GC on its own line. Each line reads name, *sent 7/31*, and a small state pill {{chip:gray|waiting}}, {{chip:green|won}} or {{chip:red|lost}}. Beside the bid number a small {{chip:yellow|sent 1/2}} badge keeps score of the letters. It is amber while a GC's letter is still out. It is green ✓ once every one went. **It counts packets**, the GCs with their own counts, prices and send date. A GC on the *Also sent to* list who got the same letter as the bid's GC is not a packet. Say a bid went to one GC with two others on the same letter. It reads as one packet sent, not three. You hover the badge for the plain words, like *1 of 2 GC letters not sent yet*. You tap the pill to set that GC's answer. The three choices pop beside it. A win rolls the bid up to **Won**. It marks the other GCs you sent to *lost · GC lost the project* for you. A confirm says exactly that, naming the GCs, before anything is written. It warns when it flips a Win/Loss you set to Lost by hand. The bid only rolls to **Lost** once every GC has said no. You tap the winner's pill again and choose {{chip:gray|waiting}} to undo the whole win. The GCs it marked lost return to waiting. The bid goes back to the section it came from. A GC on the bid's *Also sent to* list without a packet of its own reads *same letter*. Its answer is tracked with the bid. On phones the same lines sit in the card. A pill that reads {{chip:green|won}} grows a small **open the job →** link beside it. One tap opens New Job filled from that GC's packet with the bid linked. See *turn a won bid into a job*. Once the job exists, the **Links** column's green **J####** chip opens it.

## Click a row for the full story

You click anywhere on a row, not a link or button, and it expands in place:

- the bid's **flow strip**, the ten estimating steps with the next one ringed. Each step opens its tab.
- the project name and GC/builder in full. The **address**, which you tap to open Google Maps. The **due date + time**, **bid value**, **estimator**, and **distance** from the office.
- and below that, the same **notes panel** as always. It has All / Bid / Customer / Reports tabs with {{button:outline-blue|+ bid note}} and {{button:outline-blue|+ customer note}}.

Opening a row marks its notes read, so the red badge clears. You press **Escape** or click the row again to close it.

:::example find why a pending bid stalled
Tap **Pending** in the jump strip, scan the Due chips for red **(+N)** counts, then click the worst row — the dropdown shows when it was due, the last contact, and every note in one place.
:::

## Customer review — who are we really working for?

{{button:outline|Customer review}} in the tools row opens a table of every customer across all trades. It shows their bid counts by section: Unsent, Pending, Won, Started and Lost. It shows the team's reported clock hours. **Estimating hrs** is time clocked to their bids. **Job hrs** is time clocked to their jobs. Then the total. Customers are ranked by total hours.

You click any customer row to drill in:

- **Top contributors**: who logged the hours, ranked. Each person shows their share and a split bar of estimating time in orange against job time in blue.
- **Hours by bid & job**: every bid and job that collected hours, biggest first. You tap one to expand the individual clock sessions. Each shows the day, person, clock-in to clock-out, and hours.

You press **Escape** to step back to the customer list, and again to close.

:::example see who carried a big account
Open **Customer review**, click the top customer, and the contributors panel shows at a glance whether the hours came from estimating or the field — and who did the work.
:::

## The 🤖 tab — where digital-twin bids live

Bids owned or worked by a **digital twin** do not sit among the human rows. A digital twin is an AI estimator account, one of the 🤖 ones. Everything robot lives under one **🤖 Robots** tab next to Bid Board. The red count on it is audits waiting on you. It has views inside. The **Robot Board** is our bids seen through the robots. It has the same sections as the Bid Board. Each row shows the robot's number and how far off it was once we sent. **Audits** is robot bids waiting on a human review. The **Scoreboard** shows how close the robots are to our numbers by job type. It shows what is yours to do, and every run they have made. Each sealed run on a live bid is told as a five-step story. The steps are picked up, estimated blind, price sealed 🔒, waiting on our bid, and opened & scored. Then come the practice runs on past bids. The robot's sealed price stays hidden until our bid goes out. So nobody's estimate can be influenced. The tab only appears when there are robot bids or audits. Its badge counts the audits waiting on you. Opening it lands on Audits when any are pending. Guide: *see how close the robots are to our numbers*.

For the program's operators there is also a dev-only **Console** view. It holds the robot queue with its kickoff prompts. It holds the practice library of graded past bids. It holds the operator tools that used to live under Settings.

- The Robot Board lists **our** bids, not the robots' copies. It has one row per bid a robot has worked, in the Bid Board's own sections. Before we send, the row shows only where the robot stands: queued, working, or sealed 🔒. It never shows its number. Once we send with a bid value, the row shows the robot's number, ours, and how far off it was.
- A bid gets there on its own. Every plumbing bid with a readable plans link is shadowed by default. Nobody assigns a robot. The robot's own copies, the ZZ bids, never show as rows. They open from a row's doors.
- The human Bid Board's section counts and pills **do not count robot work**, so your Pending number stays yours.

:::example the robot has a number on your bid, but you can't see it yet
The row on the Robot Board reads {{chip:purple|sealed}} with no dollars. That's the envelope:
the robot locked its price before yours existed, and it opens the moment you send the bid
with a value — as a review beside your number, right then. Guide: *review the robot's number
when you send*.
:::

## The robot icon on each row — can a robot bid this?

Every row carries a small robot icon just left of the bid number. The {{icon:help|?}} beside the **Bid #** header opens the key. The key shows each state, the reference grades, and why a robot's number stays sealed until you send:

- **Grey**: a robot cannot duplicate this bid yet. You click it to see exactly what is missing. Plans link and service type are the blockers. Each has a fix hint. You can jump straight into the Edit form.
- **Yellow**: the bid has everything a robot needs. **You click it to request a robot bid**. The icon turns green and the request lands in the robot queue.
- **Green**: a robot bid has been requested. Hover shows when. You click again to withdraw the request.
- ***Grade badge (A / B / C / D / X)***: on **won, lost, and started** bids the icon answers a different question. How much can a robot learn from this record? Green A is a complete training reference. Amber is partly recorded. Grey X is no plans on file. You click for the checklist of what is missing and the quickest fix.
- ***🤖 (colorful)***: a robot bid already exists. You click for a side-by-side comparison. It shows the robot's number against ours, counts, and footage. It has jump links to the robot's counts, pricing, and CountTooling takeoff, plus our own counts and pricing.

## Deciding whether to bid at all

The go/no-go evaluation checklist lives in the bid form. It covers location, payment terms, bid documents, competition and more. You open **New Bid** or a bid's **Edit** form and tap the {{button:outline-blue|Go/no-go}} pill beside the title. It used to be the Checklist button on this board.

## On a phone

Below tablet width each row becomes a card. The bid number and due chip sit on top. Then the project name. Then GC, estimator, bid value and last contact date. Then the artifact links. Nothing scrolls sideways. You tap a card to expand the same details and notes panel.
