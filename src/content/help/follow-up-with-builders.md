---
title: follow up with builders on their bids
category: Office
roles: dev, master_technician, assistant, estimator, primary, superintendent
keywords: followup, builder review, call queue, submission, stale, snooze, PIA, quick log, call sheet, contact people, hit rate, pipeline, why we lost, loss reason, lost bids, price too high, gc lost, waiting to hear, bid tab, chase, pending bids, sent bids, low bid, high bid, rank from the bottom
order: 69
---
The **Followup** tab (Bids → Followup) is where bid follow-up lives. Opening it lands on the **Call queue** — the lens the tab defaults to; the four original lenses are one click away behind the **Old:** divider, and if you flip to one of them, re-clicking Followup keeps you where you are.

## The Call queue (new)

The newest lens — {{chip:green|new}} **Call queue** — is Followup as one list: every builder worth a call, whoever has waited longest on top. Each card shows the relationship line (won · lost · pending · hit rate · pending $) and a plain **To do / Done** table with the same three rows on every card:

- **Chase** — pending bids nobody's talked to the GC about in over a week
- **Loss reasons** — lost bids with no reason recorded
- **Bid tabs** — tabs worth asking for (any lost bid without one, or a pending bid sent three weeks ago)

Bold numbers are work owed; the Done column says what's already collected ("16 of 24 fresh", "8 of 9 recorded"); a — means nothing owed. **Click any row and it drops open in place** — the pending bids with their one-tap chips, the lost bids with the six reason chips, the gettable tabs with the capture panel — so you can collect one thing between meetings without leaving the queue. Filter chips (**To chase** · **Need a reason** · **Tab gettable**) narrow the list to one kind of gap, and {{button:blue|📞 Start call}} jumps to the builder card for a full call session.

Everything below — the four original lenses — still works exactly as before, behind the **Old:** divider:

It has four lenses — one job, four angles:

- **By builder** — the call queue. One card per builder, sorted so the builder you've ignored longest is on top. This is the lens for phone mornings: call one GC, walk through all their bids at once.
- **By status** — the outcome tables (Unsent, Not yet won or lost, Won, Started or Complete, Lost) with the per-person followup sheets, {{button:outline|Print}}/{{button:outline|PDF}}, and call scripts.
- **Why we lost** — record and review loss reasons, one GC call at a time (below).
- **Waiting to hear** — chase your sent bids for answers and bid tabs, newest first (below). Search by bid #, project name, GC/Builder, or address to jump straight to one — the "N to chase" chip keeps counting the whole queue while you search.

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

While they talk, tap what you hear on each bid — **Still pending**, **Won**, **Lost…**, or **Rebid / RFQ** — and add a note if there's more to say. Tapping **Lost…** reveals the same six why-we-lost reason chips as the Why we lost lens plus a detail box, so the loss gets categorized right there on the call. When the GC reads you the bid tab, tap {{button:outline|Bid tab…}} on that bid and type it in the words of the call — low, high, *"we were #2 from the bottom, of 6"* — it's noted on the spot and written with the save. Bids that need the ask carry a quiet italic prompt right on their row (*"ask: did our number land? can we get the bid tab?"*), and bids with a tab already on file say so, so you never ask twice. Type one **call summary** for the whole conversation, promise the **next follow-up** (Tomorrow / Next week / In 2 weeks / a custom date), and hit {{button:blue|End call & save}}.

One save does it all: the builder's contact log gets the summary, every bid you touched gets its own dated note (and Won/Lost bids get their outcome set for real), and the builder is re-queued by the promised date.

:::example the queue follows your promises
Once you promise dates, **Oldest first** stops being just "who waited longest": builders whose promised date has arrived float to the very top with a red {{chip:red|⚠ follow-up due 8/3}} badge, the no-promise builders follow in staleness order, and builders promised a future date wait at the bottom with a blue badge until their day comes — calling earlier than you said annoys people.
:::

## Record why you lost — the Friday ritual

The **Why we lost** lens turns loss reasons into a one-tap habit instead of a blank text box. A red {{chip:red|N need a reason}} chip on the other lenses shows how many lost bids have no reason recorded — click it to jump in. And once **5 or more** lost bids are waiting, the **dashboard** shows a banner with the count and the dollars unexplained — {{button:blue|Start call mode →}} drops you straight into the lens.

The header reads the same way as Waiting to hear: the red count, then one line with **how many lost, the dollars unexplained, and both loss rates**, a search box (bid #, project name, GC/Builder, or address — the red count keeps counting the whole queue while you search), and a plain sentence explaining how the queue works.

A **bids by** select in the header scopes the whole lens to one estimator — headline count, builder rail, and the keyboard queue all become "my Friday list"; All estimators is one tap back.

The left rail is a call queue: builders with unexplained lost bids first, biggest dollars on top. Pick whoever you have on the phone and their lost bids become a row of **project-name pills** — "Take 5 Dickinson," not a street fragment three other bids share. Hover a pill for the full name and address, and when the GC talks in streets, the open bid's **address button (opens Google Maps)** is right below. Six reason chips:

**GC lost the project** · **Price too high** · **Went with another sub** · **Project died / on hold** · **Never finished bid** · **No answer**

Tap one (or press keys **1–6**) and the bid is recorded and the next unexplained one opens — a builder's whole list clears in the length of the call. Type what they said in the note box first and it saves with the tap ("about 6 grand over the winner"). {{button:outline|Skip →}} moves on without recording; arrow keys move between bids; explained pills turn green.

When the GC shares the actual numbers, keep them: every lost-bid card has a **record the bid tab →** link (or a **BID TAB** line with **edit** once recorded) that opens the same capture as Waiting to hear — **low bid**, **high bid**, *"we were #2 from the bottom, of 6"* — with a live line doing the math on how far over the low we were. "About 6 grand over the winner" in a note is a story; the tab numbers are data you can compare across every loss.

Bids that already have a written note — say you typed "gc not awarded" while marking it lost in Edit Bid — come **pre-suggested**: the matching chip gets an amber ring and **Enter** confirms it, so already-explained bids clear as fast as you can press Enter. (A note that could mean two different reasons suggests nothing — you decide.)

The same six chips now live everywhere a bid gets marked lost — **Edit Bid**, the call-mode Lost flow, and the Bid Board's lost summary — so recording the reason once, anywhere, clears it here too.

And you don't need a modal at all: on a builder card, every unsent or pending bid row has a small {{chip:red|Lost…}} action that opens a two-tap panel right on the row — type what they said (optional), tap the reason, done. Lost rows on the builder card and the By-status Lost table show their reason as a colored chip (tap it to change) or an amber {{chip:yellow|why? →}} when it still needs one.

One more quality-of-life fix: jumping to a builder card from another lens used to leave that jump stuck in the page — every later visit to By builder scrolled way down to it. Jumps are now one-shot: the page scrolls when you ask, and opens at the top of the call queue every time after.

:::example a Friday morning
Dale from Knight picks up. Six pills. "1, 1, 2" — with "6k over" typed before the 2 — "1, skip, 1". Knight's row goes green and the next builder is already open.
:::

## Review why you lose

Below the queue, the **Why we lost** rollup counts every categorized loss by reason — count and dollars — and shows two loss rates: the raw one, and the one **excluding "GC lost the project"** (when your GC doesn't win, you never had a shot — that's not a competitive loss). The gap between those two numbers is how much of your loss rate isn't really yours.

Under the rollup, **Why we lose on price — what the tabs say** turns your recorded bid tabs into the numbers that change future bids: the headline — *"when we lose on price, we're typically 7.4% over the low"* — with an honest coverage count, three small charts (**how far over the low** the misses run, **where we land on the tab** — mostly #2 means close races, not blowouts — and the **median by quarter**, so you can see the pencil sharpening), and a **per-GC table sorted closest-first**: the top rows are GCs where a small price move flips outcomes; a "far off" row is a costing question, not a discount question. It follows the **bids by** estimator scope, has its own time-range pills, and sharpens with every tab you record.

## Chase the bids you just sent

The **Waiting to hear** lens is the other half of the Friday calls: instead of old lost bids, the queue is every **sent bid with no outcome yet** — and the *recent* ones come first, because that's where the feedback is still fresh and a bid tab is still gettable. The header says it all in one line: how many bids **need a chase** (nobody's talked to the GC in over a week), how many are still open and their dollars, and how many were **never called** since sending.

The left rail lists builders holding your open bids, most recently sent on top (it scrolls on its own when the list runs long; a builder whose bids were all touched this week shows **all caught up**). Pick one and their pending bids become the same **street-name pills** as the Why we lost lens — green means someone touched that bid in the last week, plain means it's waiting on a chase. Each bid card shows the dollars, **when it was sent and how long ago**, the due date, and the line that matters: **"Never contacted since sending"** in amber when nobody has followed up at all. The builder's phone number is tappable, the address opens Google Maps, and **open their builder card →** jumps to the By builder lens for contacts, notes, and a full call session.

:::example the ask on every call
"Morning — we sent our number on Saginaw two weeks ago. Did it land? Are we in the hunt? Can I get the bid tab when it's out?" Tap through their pills with the arrow keys; {{button:outline|Skip →}} moves on.
:::

**The full picture rides beside the card.** On the right (below on a phone), **The story so far** is the bid's whole conversation, newest first — every logged call with *what they said* and who logged it, notes added from the Bid Board (same store, both directions), and the letter-send as the anchor at the bottom; **show all N** unfolds the rest. Under it, **With <builder> lately** shows the latest word on each of the builder's *other* open bids — you're calling them once about all of it, so a line like *"budget review this week"* on a sibling bid or an amber *no contact since sent 7/2* is exactly what to mention while you have them. Tap a line and that bid opens on the card. Your own tap lands at the top of the story the moment you log it.

Log the answer without leaving the card — the **What happened?** chips, one tap per bid: **Left message** · **Still pending** · **Bid tab received** · **Rebid / RFQ** · **Won** · **Lost…**. **Bid tab received** opens a small capture first — the tab in the words of the call: **low bid**, **high bid**, and *"we were #2 from the bottom, of 6"* (money fields take shorthand like `230k`; every field optional, and {{button:outline|Log without numbers}} is the old one-tap). And when the tab arrives **in writing** — a GC email listing every number — flip the capture to {{button:outline|Paste the tab}} instead: paste that project's lines, every dollar amount becomes a rung on a ladder, our line is auto-marked (it says "Click" — tap another rung if not), and the low/high/rank summary fills itself. The full bidder list stays on the bid as a ladder, ours highlighted with the gap to the next bid. As you type, a live line does the math — how far over the low we were — and catches numbers that don't add up. Recorded tabs stay on the bid card as one line with a low-to-high strip. Every tap writes a bid note and stamps **Last Contact** (the pill goes green and the next bid opens), so the Bid Board and By builder queue stay current for free — and on a multi-GC bid the tap remembers **which GC** you talked to. One rule to know: only real contacts — entries with a method (call, text, email, in person) — move the Last Contact clock; a plain note you write to yourself doesn't silence the gone-quiet nag. Need to record a call after the fact? **Edit Bid → Log contact…** takes the method, the time (backdatable), the GC, and what was said — and while it's open, the form's own {{button:blue|Save}} waits until you log or cancel the contact, so a half-entered contact can't be thrown away by a form save. **Lost…** reveals the same six reason chips as the Why we lost lens — a loss you learn about on the chase call gets its reason recorded on the spot and never joins the unexplained backlog. Type **what they said** in the note box first and it saves with the tap.


## One bid, several GCs — every queue knows

A bid sent to several GCs shows up under **each** of them — in the Call queue, By builder's numbers, Why we lost and Waiting to hear — and since Bids by GC, **each GC's packet carries its own answer** (see *bid one project to multiple GCs*). So a bid won with Southern Post and lost with Burd is a **win in SPC's numbers and a loss in Burd's**: hit rates, the won · lost · pending line and the map's builder focus all count the packet that went to *that* builder; single-GC bids count exactly as before.

- When you mark one GC **won** (board, Followup, or a chase tap), the other GCs you sent to are marked **lost · GC lost the project** for you — tagged {{chip:gray|auto}} in Why we lost, and you can tap a different reason any time. Nothing to triage.
- In **Why we lost**, a multi-GC entry shows a line under the address — *Burd & Assoc.* {{chip:red|lost}} *★ $52,311 · sent 7/31 · also went to Southern Post* {{chip:green|won}} — and the reason you tap is **that GC's**; the bid's overall outcome doesn't move.
- In **By status**, the bid shows one row per GC, each in the bucket that GC's answer puts it; the GC column names the row's GC with a quiet *also to …* line, and the Lost row's reason is that GC's.
- In **Waiting to hear**, a GC that has answered drops off that builder's list while the others keep waiting. Touches (Left message, Still pending…) stay per-bid, so a touch under any GC freshens every copy.
- A GC on the bid's **Also sent to** list with no packet of its own got the same letter as the bid's GC; it rides with the bid's outcome, and one reason still clears it everywhere. On the **Bid Board**, multi-GC bids show a line per GC under the row (and wear a {{chip:gray|+2 GCs}} chip for the Also-sent-to list).

## Print a call sheet

- {{button:outline|Call sheet}} on any card prints a one-pager: the builder's people and numbers, their open bids with last-update ages, and ruled space for call notes.
- {{button:outline|Print call sheet}} in the toolbar prints the **whole queue** in call order — the classic clipboard for a phone morning.
- The per-person followup sheets (pick a name, then {{button:outline|Print}} or {{button:outline|PDF}}) still live on the **By status** lens.

## Jumping between lenses

On **By status**, the small **↗** next to a GC/Builder name jumps to that builder's card on **By builder** — it flashes amber so you can't lose it. Going the other way, the {{icon:help|magnifier}} next to any bid on a builder card opens that bid on the status lens.
