---
title: read the bid board
category: Office
roles: dev, master_technician, assistant, estimator
keywords: GC, packet, won, lost, outcome, bid board, jump strip, sections, pending, lost, show all, bid dropdown, notes, due date, last contact, days late, google maps, phone cards
order: 68
---
The Bid Board (Bids → Bid Board) shows every bid in five sections — **Unsent / Working**, **Not yet won or lost**, **Won**, **Started or Complete**, and **Lost** — plus **Estimating Health** at the bottom.

## Jump between sections

Above the sections sits one tools row — the search box, {{button:outline|Archived}} (the box icon, with a count of archived bids), and {{button:outline|Customer review}}.

A pill row stays pinned at the top of the board:

{{chip:gray|Unsent 17}} {{chip:yellow|Pending 102}} {{chip:gray|Won 26}} {{chip:gray|Started 10}} {{chip:gray|Lost 99}} {{chip:gray|Health}}

Tap a pill to jump straight to that section — it opens automatically if it was collapsed. **Health** takes you to the Estimating Pulse at the bottom. Each pill shows the live bid count; **Pending** is highlighted because it's usually where the action is.

The two biggest sections (**Not yet won or lost** and **Lost**) start with their first 25 bids showing. Use {{button:outline-blue|Show all N ▾}} at the bottom of the list to see the rest; search always looks through every bid either way.

**Not yet won or lost** lists the most recently *sent* bid first (falling back to the bid date if a row has no sent date) — the freshest submissions are at the top while you wait for answers. The other sections keep their due-date order, soonest first.

## Read a row

Each row leads with the bid number, flanked by **jump icons** — Counts, Takeoffs, Labor, Pricing, and Cover Letter, in the same order as the tabs across the top. Hover one to see its name; click it to land on that tab for that bid, one click from the board. The **Edit** gear sits on the number's right, and a red badge next to the number means unread notes. Then:

- **Due Date** — a chip with the weekday + date on top and a signed day count under it: **(+4)** means four days past due, **(-2)** means due in two days. The red/amber colors appear **only on unsent bids** — once a bid is sent, the chip goes quiet (the wait is on the GC), and once it's decided the day count drops too. Not sure what a color means? Tap the little red/yellow/grey key beside the **Due Date** header for the legend. 
- **Last Contact** — same two-line pattern: the date on top, **(+6)** = six days since you last touched the bid. Tap it to log a contact.
- **Links** — icons for only the artifacts the bid actually has: project folder, job plans, CountTooling plans, bid submission.
- **GC lines** — under a multi-GC bid, one line per GC: *sent date · state · name*. **Tap the name** to read and leave notes about that GC on this bid (a 💬 count shows who has notes); the state pill still sets won / lost.

Distance to the office lives in the row dropdown, along with the address — tap the address there to open Google Maps.

## Bids sent to more than one GC

When a bid has a packet per GC (see *bid one project to multiple GCs*), its GC/Builder cell lists each GC on its own line — name · *sent 7/31* · a small state pill {{chip:gray|waiting}} / {{chip:green|won}} / {{chip:red|lost}}. Tap the pill to set that GC's answer (the three choices pop beside it): a win rolls the bid up to **Won** and marks the other GCs you sent to *lost · GC lost the project* for you; the bid only rolls to **Lost** once every GC has said no. A GC on the bid's *Also sent to* list without a packet of its own reads *same letter* — its answer is tracked with the bid. On phones the same lines sit in the card.

## Click a row for the full story

Click anywhere on a row (not a link or button) and it expands in place:

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
among the human rows. Everything robot lives under one **🤖** tab next to Bid Board, with views
inside: the **Robot Board** (twin bids, with its live count), **Audits** (robot bids waiting on
a human review), and **Shadows** — every robot practice bid told as a five-step story:
requested, estimated blind, price sealed 🔒, waiting on our bid, opened & scored. The robot's
sealed price stays hidden until our bid goes out, so nobody's estimate can be influenced. The
tab only appears when there are robot bids or audits, and its badge counts the audits waiting
on you — opening it lands on Audits when any are pending.

- A bid moves to the Robot Board when its **Estimator is a twin** (or a twin created it).
  Un-assign the twin and it comes back to the human board.
- The Robot Board is the **same board** — same sections, same pills, same row tools, same
  Edit form. Nothing about a robot bid is read-only for you; reviewing or correcting twin
  work happens right there.
- The human Bid Board's section counts and pills **don't count robot bids**, so your
  Pending number stays yours.

:::example a bid "disappeared" after you assigned the twin
Set a bid's Estimator to a twin and the row leaves the Bid Board — that's the scope moving,
not a deletion. Open {{button:outline|🤖}} and flip to the {{button:outline|Robot Board}}
view — it's right there.
:::

## The robot icon on each row — can a robot bid this?

Every row carries a small robot icon just left of the bid number:

- **Grey** — a robot can't duplicate this bid yet. Click it to see exactly what's
  missing (plans link and service type are the blockers) with a fix hint for each,
  and jump straight into the Edit form.
- **Yellow** — the bid has everything a robot needs. **Click it to request a robot
  bid** — the icon turns green and the request lands in the robot queue.
- **Green** — a robot bid has been requested (hover shows when). Click again to
  withdraw the request.
- **🤖 (colorful)** — a robot bid already exists. Click for a side-by-side comparison —
  the robot's number vs ours, counts, and footage — with jump links to the robot's
  counts, pricing, and CountTooling takeoff, plus our own counts and pricing.

## Deciding whether to bid at all

The go/no-go evaluation checklist (location, payment terms, bid documents, competition…) lives in the bid form: open **New Bid** or a bid's **Edit** form and tap the {{button:outline-blue|Go/no-go}} pill beside the title. It used to be the "Checklist" button on this board.

## On a phone

Below tablet width each row becomes a card — bid number and due chip on top, project name, then GC · estimator · bid value · last contact date, and the artifact links. Nothing scrolls sideways. Tap a card to expand the same details and notes panel.
