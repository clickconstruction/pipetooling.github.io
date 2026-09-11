---
title: read the bid board
category: Office
roles: dev, master_technician, assistant, estimator
keywords: GC, packet, won, lost, outcome, bid board, jump strip, sections, pending, lost, show all, bid dropdown, notes, due date, last contact, days late, google maps, phone cards, trade pill, counts, sent 1/2, call queue, chase, quiet, robots tab, undo won, matches by value, link, cost it, costed, budget
order: 68
---
The Bid Board (Bids → Bid Board) shows every bid in five sections — **Unsent / Working**, **Not yet won or lost**, **Won**, **Started or Complete**, and **Lost** — plus **Estimating Health** at the bottom.

## Jump between sections

Above the sections sits one tools row — the search box, {{button:outline|Archived}} (the box icon, with a count of archived bids), and {{button:outline|Customer review}}.

A pill row stays pinned at the top of the board:

{{chip:gray|Plumbing}} {{chip:gray|Unsent 17}} {{chip:yellow|Pending 101}} {{chip:gray|Won 26}} {{chip:gray|Started 10}} {{chip:gray|Lost 114}} {{chip:gray|Health}}

Tap a pill to jump straight to that section — it opens automatically if it was collapsed. **Health** takes you to the Estimating Pulse at the bottom. Each pill shows the live bid count; **Pending** is highlighted because it's usually where the action is.

**The counts follow the trade pill — and the row says so.** The word at the front of the pill row — **Plumbing:**, **Electrical:**…, or **all trades:** when no pill is selected — names the trade every number on this page is for; switch the trade pill and that word, the board and its counts switch together. **Every count is a count of bids**: a bid you sent to three GCs is one bid in Pending, not three (the GC lines under its row keep the per-GC detail). The lost-bids card on the **Dashboard** counts the whole company and says *· all trades* on its number, so "59 need a reason · Plumbing" here and "60 lost bids … · all trades" there are both right — the labels tell you which question each answers.

The two biggest sections (**Not yet won or lost** and **Lost**) start with their first 25 bids showing. Use {{button:outline-blue|Show all N ▾}} at the bottom of the list to see the rest; search always looks through every bid either way.

**Not yet won or lost** lists the most recently *sent* bid first (falling back to the bid date if a row has no sent date) — the freshest submissions are at the top while you wait for answers. Because the section sorts by sent date, every row prints it: a small {{chip:gray|sent Wed 9/2}} line sits under the Due chip, so the order reads as what it is. The other sections keep their due-date order, soonest first.

In **Unsent / Working**, a bid with no due date shows a dashed {{chip:gray|No due date (+N)}} chip counting its days on the board instead of a blank — and it turns {{chip:red|No due date (+15)}} red after 14 days, so an undated bid can't rot quietly. Give it a due date (Edit bid) or archive it.

While the board is still fetching after you open it, you see **Loading bids…** with grey placeholder rows — never a false "No bids yet".

## Read a row

Each row leads with the bid number, flanked by **jump icons** — Counts, Takeoffs, Labor, Pricing, and Cover Letter, in the same order as the tabs across the top. Hover one to see its name; click it to land on that tab for that bid, one click from the board. A thin **flow bar** runs under the icons — green phases are done, blue is the next move, grey is not yet; hover it for *7 of 9 done · next: Cover letter* (see [see where a bid is in the estimating flow](?g=see-where-a-bid-is-in-the-flow)). The **Edit** gear sits on the number's right, and a red badge next to the number means unread notes. Then:

- **Robot icon** — right before the bid number. On a live bid it says the robot is on it (outline = queued, solid = counting, 🔒 = its number is sealed until you send, green ✓ = scored after you sent) or, in amber with a **?** or a count, that the robot needs something from you — plans it can't open or a question it asked; click to fix or answer. On a sent or decided bid the icon wears a grade letter, **A** through **X**, for how much a robot can learn from the record. The small **?** beside the **Bid #** header (beside the trade chip in the pill row on a phone) opens the full key. See [let the robots shadow a bid](?g=let-the-robots-shadow-a-bid).
- **Due Date** — a chip with the weekday + date on top and a signed day count under it: **(+4)** means four days past due, **(-2)** means due in two days. The red/amber colors appear **only on unsent bids** — once a bid is sent, the chip goes quiet (the wait is on the GC), and once it's decided the day count drops too. That quiet is on purpose: the board's colours are about getting the letter out the door. **Chasing a sent bid lives on the Followup tab** — its **Call queue** ranks every builder by who has waited longest and lists the pending bids nobody has talked to in over a week (see [follow up with builders on their bids](?g=follow-up-with-builders)). Not sure what a color means? Tap the little red/yellow/grey key beside the **Due Date** header for the legend. 
- **Last Contact** — same two-line pattern: the date on top, **(+6)** = six days since you last touched the bid. Tap it to log a contact.
- **Links** — icons for only the artifacts the bid actually has: project folder, job plans, CountTooling plans, bid submission.
- **GC lines** — under a multi-GC bid, one line per GC: *sent date · state · name*. **Tap the name** to read and leave notes about that GC on this bid (a 💬 count shows who has notes); the state pill still sets won / lost.

Distance to the office lives in the row dropdown, along with the address — tap the address there to open Google Maps.

In the **Lost** section, every bid carries a **Why did we lose?** strip. When the loss has a reason recorded it reads the reason (category first, then what they said); when it doesn't, the strip says so — *Add why: an uncategorized loss can't teach the robots* — and puts the **six reason chips right on the row**, so recording the reason is one tap without opening anything (a note on the bid may even pre-suggest a chip with an amber ring). An uncategorized loss gets left out of the robot estimators' training math, which is why the strip asks.

## Won rows: is the job linked, and was the bid costed?

On a won row the Links column carries two more chips. {{chip:yellow|J1007 matches by value · Link}} means a job carries this bid's value to the dollar but is not linked to it yet — press **Link** and confirm: the job is stamped with the bid, the bid reads Started, and the bid's estimate becomes the job's budget (Burn on the job's Costs tab reads against it). The other chip reads the Cost Estimate tab: {{chip:green|costed · 47 h}} (hours and a labor rate), {{chip:yellow|hours only · 36 h}} (set the rate), or {{chip:red|no cost estimate · Cost it →}} (opens the bid's Labor tab). A job made from the bid shows the usual {{chip:green|J1007}} chip instead of the match.

## Bids sent to more than one GC

When a bid has a packet per GC (see *bid one project to multiple GCs*), its GC/Builder cell lists each GC on its own line — name · *sent 7/31* · a small state pill {{chip:gray|waiting}} / {{chip:green|won}} / {{chip:red|lost}}. Beside the bid number a small {{chip:yellow|sent 1/2}} badge keeps score of the letters: amber while a GC's letter is still out, green ✓ once every one went. **It counts packets** — GCs with their own counts, prices and send date. A GC on the *Also sent to* list who got the same letter as the bid's GC is not a packet, so a bid sent to one GC with two others on the same letter reads as one packet sent, not three. Hover the badge for the plain words ("1 of 2 GC letters not sent yet"). Tap the pill to set that GC's answer (the three choices pop beside it): a win rolls the bid up to **Won** and marks the other GCs you sent to *lost · GC lost the project* for you — a confirm says exactly that, naming the GCs, before anything is written (and warns when it flips a Win/Loss you set to Lost by hand); the bid only rolls to **Lost** once every GC has said no. Tap the winner's pill again and choose {{chip:gray|waiting}} to undo the whole win: the GCs it marked lost return to waiting and the bid goes back to the section it came from. A GC on the bid's *Also sent to* list without a packet of its own reads *same letter* — its answer is tracked with the bid. On phones the same lines sit in the card. A pill that reads {{chip:green|won}} grows a small **open the job →** link beside it — one tap opens New Job filled from that GC's packet with the bid linked (see *turn a won bid into a job*); once the job exists, the **Links** column's green **J####** chip opens it.

## Click a row for the full story

Click anywhere on a row (not a link or button) and it expands in place:

- the bid's **flow strip** — the ten estimating steps with the next one ringed; each step opens its tab,
- the project name and GC/builder in full, the **address** (tap to open Google Maps), **due date + time**, **bid value**, **estimator**, and **distance** from the office,
- and below that, the same **notes panel** as always — All / Bid / Customer / Reports tabs with {{button:outline-blue|+ bid note}} and {{button:outline-blue|+ customer note}}.

Opening a row marks its notes read, so the red badge clears. Press **Escape** or click the row again to close it.

:::example find why a pending bid stalled
Tap **Pending** in the jump strip, scan the Due chips for red **(+N)** counts, then click the worst row — the dropdown shows when it was due, the last contact, and every note in one place.
:::

## Customer review — who are we really working for?

{{button:outline|Customer review}} in the tools row opens a table of every customer across all trades: their bid counts by section (Unsent / Pending / Won / Started / Lost) and the team's reported clock hours — **Estimating hrs** (clocked to their bids), **Job hrs** (clocked to their jobs), and the total. Customers are ranked by total hours.

Click any customer row to drill in:

- **Top contributors** — who logged the hours, ranked, with each person's share and a split bar showing estimating (orange) vs job (blue) time.
- **Hours by bid & job** — every bid and job that collected hours, biggest first. Tap one to expand the individual clock sessions: day, person, clock-in – clock-out, hours.

Press **Escape** to step back to the customer list, and again to close.

:::example see who carried a big account
Open **Customer review**, click the top customer, and the contributors panel shows at a glance whether the hours came from estimating or the field — and who did the work.
:::

## The 🤖 tab — where digital-twin bids live

Bids owned or worked by a **digital twin** (an AI estimator account — the 🤖 ones) don't sit
among the human rows. Everything robot lives under one **🤖 Robots** tab next to Bid Board (the red count on it is audits waiting on you), with views
inside: the **Robot Board** (our bids seen through the robots — the same sections as the Bid Board, with the robot's number and how far off it was once we sent), **Audits** (robot bids waiting on
a human review), and the **Scoreboard** — how close the robots are to our numbers by job type,
what is yours to do, and every run they have made: each sealed run on a live bid told as a
five-step story (picked up, estimated blind, price sealed 🔒, waiting on our bid, opened & scored),
then the practice runs on past bids. The robot's sealed price stays hidden until our bid goes
out, so nobody's estimate can be influenced. The tab only appears when there are robot bids or
audits, and its badge counts the audits waiting on you — opening it lands on Audits when any are
pending. Guide: *see how close the robots are to our numbers*.

(For the program's operators there's also a dev-only **Console** view: the robot queue with
its kickoff prompts, the practice library of graded past bids, and the operator tools that
used to live under Settings.)

- The Robot Board lists **our** bids, not the robots' copies: one row per bid a robot has
  worked, in the Bid Board's own sections. Before we send, the row shows only where the
  robot stands (queued, working, sealed 🔒) — never its number. Once we send with a bid
  value, the row shows the robot's number, ours, and how far off it was.
- A bid gets there on its own. Every plumbing bid with a readable plans link is shadowed
  by default; nobody assigns a robot. The robot's own copies (the "ZZ" bids) never show
  as rows — they open from a row's doors.
- The human Bid Board's section counts and pills **don't count robot work**, so your
  Pending number stays yours.

:::example the robot has a number on your bid, but you can't see it yet
The row on the Robot Board reads {{chip:purple|sealed}} with no dollars. That's the envelope:
the robot locked its price before yours existed, and it opens the moment you send the bid
with a value — as a review beside your number, right then. Guide: *review the robot's number
when you send*.
:::

## The robot icon on each row — can a robot bid this?

Every row carries a small robot icon just left of the bid number. The {{icon:help|?}} beside the **Bid #** header opens the key — each state, the reference grades, and why a robot's number stays sealed until you send:

- **Grey** — a robot can't duplicate this bid yet. Click it to see exactly what's
  missing (plans link and service type are the blockers) with a fix hint for each,
  and jump straight into the Edit form.
- **Yellow** — the bid has everything a robot needs. **Click it to request a robot
  bid** — the icon turns green and the request lands in the robot queue.
- **Green** — a robot bid has been requested (hover shows when). Click again to
  withdraw the request.
- **Grade badge (A / B / C / D / X)** — on **won, lost, and started** bids the icon
  answers a different question: how much can a robot *learn* from this record? Green A
  = complete training reference; amber = partly recorded; grey X = no plans on file.
  Click for the checklist of what's missing and the quickest fix.
- **🤖 (colorful)** — a robot bid already exists. Click for a side-by-side comparison —
  the robot's number vs ours, counts, and footage — with jump links to the robot's
  counts, pricing, and CountTooling takeoff, plus our own counts and pricing.

## Deciding whether to bid at all

The go/no-go evaluation checklist (location, payment terms, bid documents, competition…) lives in the bid form: open **New Bid** or a bid's **Edit** form and tap the {{button:outline-blue|Go/no-go}} pill beside the title. It used to be the "Checklist" button on this board.

## On a phone

Below tablet width each row becomes a card — bid number and due chip on top, project name, then GC · estimator · bid value · last contact date, and the artifact links. Nothing scrolls sideways. Tap a card to expand the same details and notes panel.
