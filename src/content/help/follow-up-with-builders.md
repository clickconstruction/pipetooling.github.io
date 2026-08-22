---
title: follow up with builders on their bids
category: Office
roles: dev, master_technician, assistant, estimator, primary, superintendent
keywords: followup, builder review, call queue, submission, stale, snooze, PIA, quick log, call sheet, contact people, hit rate, pipeline, why we lost, loss reason, lost bids, price too high, gc lost, waiting to hear, bid tab, chase, pending bids, sent bids
order: 69
---
The **Followup** tab (Bids → Followup) is where bid follow-up lives. It has three lenses — one job, three angles:

- **By builder** — the call queue. One card per builder, sorted so the builder you've ignored longest is on top. This is the lens for phone mornings: call one GC, walk through all their bids at once.
- **By status** — the outcome tables (Unsent, Not yet won or lost, Won, Started or Complete, Lost) with the per-person followup sheets, {{button:outline|Print}}/{{button:outline|PDF}}, and call scripts.
- **Why we lost** — record and review loss reasons, one GC call at a time (below).
- **Waiting to hear** — chase your recently sent bids for answers and bid tabs, newest first (below). Search by bid #, project name, GC/Builder, or address to jump straight to one — the "N to chase" chip keeps counting the whole window while you search.

Flip between them with the {{button:blue|By builder}} / {{button:outline|By status}} / {{button:outline|Why we lost}} / {{button:outline|Waiting to hear}} toggle at the top. The **Stale after N days** box is shared between the first two — set it once and both lenses highlight the same bids in red.

## Work the queue

Each builder card shows the whole relationship at a glance: {{chip:green|7 won}} {{chip:red|9 lost}} {{chip:yellow|24 pending}} plus a **hit rate** chip (share of decided bids you won) and an **open $** chip (unsent + pending value). The builder's phone number is tappable right on the card, and **Contact people** with their numbers sit on the right.

Inside the card, every unsent and pending bid shows **when it last got an update** — red means it's past your stale threshold. That's your talking list for the call.

:::example run a call morning
Open **By builder**, and start at the top — that's whoever waited longest. Tap the number, go through their red bids one by one, then log the call (below). The card drops down the queue and the next builder is on top.
:::

## Log the call in one line

At the bottom of each card's bid list is a one-line composer: pick **Phone / Text / Email**, type what they said, and hit {{button:blue|Log for builder + 2 bids}}. One click writes the builder's contact log **and** stamps every check-marked bid above (pending bids are pre-checked). No more logging the same call three times.

When the news is about **one bid, not the relationship** — a GC email about a single project, say — use the quiet {{button:outline|bids only}} button instead: it notes the checked bids and freshens their clocks **without** logging builder contact, so the builder doesn't move down the call queue. And the fastest aim: tap the **📝** on any bid row to check just that bid and land in the note box — 📝, type, "this bid only", done.

## Snooze, PIA, and quiet builders

- {{button:outline|Snooze ▾}} on a card hides the builder from the queue until a wake date, with an optional note ("awarding after board mtg"). **The whole team sees it**, and the builder returns automatically. Snoozed builders wait in a block below the queue with a **Wake now** button.
- **PIA** still works like before — a permanent "stop asking" flag — and is now shared with the whole team too, on every device.
- Builders with **no bids yet** fold into a collapsed **Quiet builders** block at the bottom so the queue stays real.

## Run a call session

{{button:blue|📞 Start call session}} on a builder card opens the "GC on the phone" screen: the top shows who to dial (first contact person, tappable number) and your win rate with them, then every open bid, top to bottom.

While they talk, tap what you hear on each bid — **Still pending**, **Won**, **Lost…**, or **Rebid / RFQ** — and add a note if there's more to say. Tapping **Lost…** reveals the same six why-we-lost reason chips as the Why we lost lens plus a detail box, so the loss gets categorized right there on the call. Type one **call summary** for the whole conversation, promise the **next follow-up** (Tomorrow / Next week / In 2 weeks / a custom date), and hit {{button:blue|End call & save}}.

One save does it all: the builder's contact log gets the summary, every bid you touched gets its own dated note (and Won/Lost bids get their outcome set for real), and the builder is re-queued by the promised date.

:::example the queue follows your promises
Once you promise dates, **Oldest first** stops being just "who waited longest": builders whose promised date has arrived float to the very top with a red {{chip:red|⚠ follow-up due 8/3}} badge, the no-promise builders follow in staleness order, and builders promised a future date wait at the bottom with a blue badge until their day comes — calling earlier than you said annoys people.
:::

## Record why you lost — the Friday ritual

The **Why we lost** lens turns loss reasons into a one-tap habit instead of a blank text box. A red {{chip:red|N need a reason}} chip on the other lenses shows how many lost bids have no reason recorded — click it to jump in. And once **5 or more** lost bids are waiting, the **dashboard** shows a banner with the count and the dollars unexplained — {{button:blue|Start call mode →}} drops you straight into the lens.

The left rail is a call queue: builders with unexplained lost bids first, biggest dollars on top. Pick whoever you have on the phone and their lost bids become a row of **project-name pills** — "Take 5 Dickinson," not a street fragment three other bids share. Hover a pill for the full name and address, and when the GC talks in streets, the open bid's **address button (opens Google Maps)** is right below. Six reason chips:

**GC lost the project** · **Price too high** · **Went with another sub** · **Project died / on hold** · **Never finished bid** · **No answer**

Tap one (or press keys **1–6**) and the bid is recorded and the next unexplained one opens — a builder's whole list clears in the length of the call. Type what they said in the note box first and it saves with the tap ("about 6 grand over the winner"). {{button:outline|Skip →}} moves on without recording; arrow keys move between bids; explained pills turn green.

Bids that already have a written note — say you typed "gc not awarded" while marking it lost in Edit Bid — come **pre-suggested**: the matching chip gets an amber ring and **Enter** confirms it, so already-explained bids clear as fast as you can press Enter. (A note that could mean two different reasons suggests nothing — you decide.)

The same six chips now live everywhere a bid gets marked lost — **Edit Bid**, the call-mode Lost flow, and the Bid Board's lost summary — so recording the reason once, anywhere, clears it here too.

And you don't need a modal at all: on a builder card, every unsent or pending bid row has a small {{chip:red|Lost…}} action that opens a two-tap panel right on the row — type what they said (optional), tap the reason, done. Lost rows on the builder card and the By-status Lost table show their reason as a colored chip (tap it to change) or an amber {{chip:yellow|why? →}} when it still needs one.

One more quality-of-life fix: jumping to a builder card from another lens used to leave that jump stuck in the page — every later visit to By builder scrolled way down to it. Jumps are now one-shot: the page scrolls when you ask, and opens at the top of the call queue every time after.

:::example a Friday morning
Dale from Knight picks up. Six pills. "1, 1, 2" — with "6k over" typed before the 2 — "1, skip, 1". Knight's row goes green and the next builder is already open.
:::

## Review why you lose

Below the queue, the **Why we lost** rollup counts every categorized loss by reason — count and dollars — and shows two loss rates: the raw one, and the one **excluding "GC lost the project"** (when your GC doesn't win, you never had a shot — that's not a competitive loss). The gap between those two numbers is how much of your loss rate isn't really yours.

## Chase the bids you just sent

The **Waiting to hear** lens is the other half of the Friday calls: instead of old lost bids, the queue is every **sent bid with no outcome yet** — and the *recent* ones come first, because that's where the feedback is still fresh and a bid tab is still gettable. The **Sent within** pills (30 / 60 / 90 days / All, default 60) keep the queue to the recent past.

The left rail lists builders holding your open bids, most recently sent on top. Pick one and their pending bids become the same **street-name pills** as the Why we lost lens — green means someone touched that bid in the last week, plain means it's waiting on a chase. Each bid card shows the dollars, **when it was sent and how long ago**, the due date, and the line that matters: **"Never contacted since sending"** in amber when nobody has followed up at all. The builder's phone number is tappable, the address opens Google Maps, and **open their builder card →** jumps to the By builder lens for contacts, notes, and a full call session.

:::example the ask on every call
"Morning — we sent our number on Saginaw two weeks ago. Did it land? Are we in the hunt? Can I get the bid tab when it's out?" Tap through their pills with the arrow keys; {{button:outline|Skip →}} moves on.
:::

Log the answer without leaving the card — one tap per bid: **Left message** · **Still pending** · **Bid tab received** · **Rebid / RFQ** · **Won** · **Lost…**. Every tap writes a bid note and stamps **Last Contact** (the pill goes green and the next bid opens), so the Bid Board and By builder queue stay current for free. **Lost…** reveals the same six reason chips as the Why we lost lens — a loss you learn about on the chase call gets its reason recorded on the spot and never joins the unexplained backlog. Type **what they said** in the note box first and it saves with the tap.

Below the queue, the **Waiting to hear** rollup keeps you honest: how much sent work is still open, how many bids were **never chased since sending** (count and dollars), and the age of the oldest untouched one.

## One bid, several GCs — every queue knows

A bid recorded as sent to several GCs (the **Also sent to** row in Edit Bid, or Versions pointed at different GCs) shows up under **each** of those GCs in both the Why we lost and Waiting to hear queues — each entry dials that GC's own number, and the card lists everyone else who got it. Outcomes stay per-bid: record the reason (or log a touch) with whichever GC answers and the bid clears in every queue at once. On the **Bid Board**, multi-GC bids wear a {{chip:gray|+2 GCs}} chip next to the GC name — hover it for the full send list.

## Print a call sheet

- {{button:outline|Call sheet}} on any card prints a one-pager: the builder's people and numbers, their open bids with last-update ages, and ruled space for call notes.
- {{button:outline|Print call sheet}} in the toolbar prints the **whole queue** in call order — the classic clipboard for a phone morning.
- The per-person followup sheets (pick a name, then {{button:outline|Print}} or {{button:outline|PDF}}) still live on the **By status** lens.

## Jumping between lenses

On **By status**, the small **↗** next to a GC/Builder name jumps to that builder's card on **By builder** — it flashes amber so you can't lose it. Going the other way, the {{icon:help|magnifier}} next to any bid on a builder card opens that bid on the status lens.
