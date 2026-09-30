---
title: follow up with builders on their bids
category: Office
roles: dev, master_technician, assistant, estimator, primary, superintendent
keywords: followup, builder review, call queue, submission, stale, snooze, PIA, quick log, call sheet, contact people, hit rate, pipeline, why we lost, loss reason, lost bids, price too high, gc lost, waiting to hear, bid tab, chase, pending bids, sent bids, low bid, high bid, rank from the bottom, won, undo won, waiting, open the job, board went quiet
order: 69
---
The Followup tab is where bid follow-up lives. It opens on the Call queue, the list of every builder worth a call.

Open **Bids → Followup**. The Bid Board deliberately goes colour-quiet once a bid is sent. The red and amber there are about getting letters out. So *this* tab is where the chase happens. Opening it lands on the **Call queue**, the lens the tab defaults to. A lens is one view of the same bids. The four original lenses are one click away behind the **Old:** divider. If you flip to one of them, re-clicking Followup keeps you where you are.

## The Call queue (new)

The newest lens is {{chip:green|new}} **Call queue**. It is Followup as one list: every builder worth a call, whoever has waited longest on top. The oldest last contact comes first. Among builders nobody has ever called, the one whose bid has sat quiet longest comes first. A note on a *lost* bid doesn't count as contact. Each card shows the relationship line. It reads *won · lost · pending · hit rate · pending $*. Each card also shows a plain **To do / Done** table with the same three rows on every card:

- **Chase**: pending bids nobody's talked to the GC about in over a week. GC means the general contractor.
- **Loss reasons**: lost bids with no reason recorded.
- **Bid tabs**: tabs worth asking for. A bid tab is the GC's list of every bidder's number. Worth asking for means any lost bid without one, or a pending bid sent three weeks ago.

The header line counts **bids** and names the trade you're looking at. It reads *· Plumbing · 96 bids · 99 GC packets to chase · 59 losses need a reason …*. Bids come first. When a bid went to more than one GC, the GC-packet figure follows as the second number. A GC packet is one GC's copy of the bid. That is because the queue lists one row per GC, while a bid is still one bid. Three GCs means three calls. Bold numbers are work owed. The Done column says what's already collected. It reads like *16 of 24 fresh* or *8 of 9 recorded*. A *—* means nothing owed. **Click any row and it drops open in place**. The pending bids open with their one-tap chips. The lost bids open with the six reason chips. The gettable tabs open with the capture panel. So you can collect one thing between meetings without leaving the queue. The one-tap chips on a pending bid are the same ones as Waiting to hear. They are ***Left message · Still pending · Bid tab received · Rebid / RFQ · Won · Lost…***. Every tap writes the bid note and stamps Last Contact for you.

:::example Won on a bid that went to several GCs
Tap **Won** under one builder on a multi-GC bid and the app asks first, in one sentence: *Mark Southern Post Won? This marks the other GC (Burd & Assoc.) Lost — GC lost the project and the bid Won.* **Cancel** leaves the row exactly as it was; confirm and it all happens at once. Tapped the wrong builder? On the bid's GC line (Bid Board or Edit Bid) set the winner back to {{chip:gray|waiting}} — the GCs it marked lost return to waiting and the bid goes back to the section it came from.
:::

Filter chips narrow the list to one kind of gap. They are **To chase**, **Need a reason** and **Tab gettable**. {{button:blue|📞 Start call}} jumps to the builder card for a full call session.

Everything below still works exactly as before, behind the **Old:** divider. That is the four original lenses:

It has four lenses. That is one job, four angles:

- **By builder**: the call queue. One card per builder, sorted so the builder you've ignored longest is on top. This is the lens for phone mornings. Call one GC, and walk through all their bids at once.
- **By status**: the outcome tables. They are Unsent, Not yet won or lost, Won, Started or Complete, and Lost. They come with the per-person followup sheets, {{button:outline|Print}}/{{button:outline|PDF}}, and call scripts.
- **Why we lost**: record and review loss reasons, one GC call at a time. See below.
- **Waiting to hear**: chase your sent bids for answers and bid tabs, newest first. See below. Search by bid #, project name, GC/Builder, or address to jump straight to one. The *N to chase* chip keeps counting the whole queue while you search.

Flip between them with the toggle at the top. It reads {{button:blue|By builder}} / {{button:outline|By status}} / {{button:outline|Why we lost}} / {{button:outline|Waiting to hear}}. The **Stale after N days** box is shared between the first two. Set it once and both lenses highlight the same bids in red.

## Work the queue

Each builder card shows the whole relationship at a glance: {{chip:green|7 won}} {{chip:red|9 lost}} {{chip:yellow|24 pending}}. It adds a **hit rate** chip, the share of decided bids you won. It adds an **open $** chip, the unsent plus pending value. The builder's phone number is tappable right on the card. **Contact people** with their numbers sit on the right.

Inside the card, every unsent and pending bid shows **when it last got an update**. Red means it's past your stale threshold. That's your talking list for the call.

:::example run a call morning
Open **By builder**, and start at the top — that's whoever waited longest. Tap the number, go through their red bids one by one, then log the call (below). The card drops down the queue and the next builder is on top.
:::

## Log the call in one line

At the bottom of each card's bid list is a one-line composer. Pick **Phone / Text / Email**, type what they said, and hit {{button:blue|Log for builder + 2 bids}}. One click writes the builder's contact log **and** stamps every check-marked bid above. Pending bids are pre-checked. No more logging the same call three times.

Sometimes the news is about **one bid, not the relationship**, say a GC email about a single project. Then use the quiet {{button:outline|bids only}} button instead. It notes the checked bids and freshens their clocks **without** logging builder contact. So the builder doesn't move down the call queue. The fastest aim is the **📝** on any bid row. Tap it to check just that bid and land in the note box. So it is 📝, type, "this bid only", done.

## Snooze, PIA, and quiet builders

- {{button:outline|Snooze ▾}} on a card hides the builder from the queue until a wake date. Add an optional note, like *awarding after board mtg*. **The whole team sees it**, and the builder returns automatically. Snoozed builders wait in a block below the queue with a **Wake now** button.
- **PIA** still works like before. It is a permanent "stop asking" flag. It is now shared with the whole team too, on every device.
- Builders with **no bids yet** fold into a collapsed **Quiet builders** block at the bottom so the queue stays real.

## Run a call session

{{button:blue|📞 Start call session}} on a builder card opens the "GC on the phone" screen. The top shows who to dial, the first contact person with a tappable number. It shows your win rate with them. Then every open bid follows, top to bottom.

While they talk, tap what you hear on each bid. The choices are **Still pending**, **Won**, **Lost…**, or **Rebid / RFQ**. RFQ means a request for quote. Add a note if there's more to say. Tapping **Lost…** reveals the same six why-we-lost reason chips as the Why we lost lens, plus a detail box. So the loss gets categorized right there on the call. When the GC reads you the bid tab, tap {{button:outline|Bid tab…}} on that bid. Type it in the words of the call: low, high, *"we were #2 from the bottom, of 6"*. It's noted on the spot and written with the save. Bids that need the ask carry a quiet italic prompt right on their row. It reads *"ask: did our number land? can we get the bid tab?"*. Bids with a tab already on file say so, so you never ask twice. Type one **call summary** for the whole conversation. Promise the **next follow-up**: Tomorrow, Next week, In 2 weeks, or a custom date. Then hit {{button:blue|End call & save}}.

One save does it all. The builder's contact log gets the summary. Every bid you touched gets its own dated note. Won and Lost bids get their outcome set for real. The builder is re-queued by the promised date.

:::example the queue follows your promises
Once you promise dates, **Oldest first** stops being just "who waited longest": builders whose promised date has arrived float to the very top with a red {{chip:red|⚠ follow-up due 8/3}} badge, the no-promise builders follow in staleness order, and builders promised a future date wait at the bottom with a blue badge until their day comes — calling earlier than you said annoys people.
:::

## Record why you lost — the Friday ritual

The **Why we lost** lens turns loss reasons into a one-tap habit instead of a blank text box. A red {{chip:red|N need a reason}} chip on the other lenses shows how many lost bids have no reason recorded. Click it to jump in. Once **5 or more** lost bids are waiting, the **dashboard** shows a banner with the count and the dollars unexplained. {{button:blue|Start call mode →}} drops you straight into the lens.

There's a second reason the tap matters. The app now says it wherever you mark a bid lost without a reason. It reads *Add why: an uncategorized loss can't teach the robots.* The robot estimators train on our decided bids. A loss with no category can't be told apart from a loss that never really competed. That is a GC that lost the project, or a project that died. So the whole record gets left out of their training math. One tap on a reason chip keeps it usable. The amber line appears on Edit Bid, the quick lost panel, and the per-GC Sent panel. The six chips are always right there. It never blocks the save.

The header reads the same way as Waiting to hear. First is the red count of **lost bids** that need a reason. Then one line says **how many lost**. Bids come first, then the GC-packet figure when any went to several GCs. It reads *of 114 lost · 115 GC packets · Plumbing*. The line also holds the dollars unexplained and both loss rates. Then comes a search box for bid #, project name, GC/Builder, or address. The red count keeps counting the whole queue while you search. Last is a plain sentence explaining how the queue works. The trade name sits right on the line. These are this trade pill's bids, while the Dashboard card counts *all trades*.

A **bids by** select in the header scopes the whole lens to one estimator. The headline count, builder rail, and the keyboard queue all become "my Friday list". All estimators is one tap back.

The left rail is a call queue: builders with unexplained lost bids first, biggest dollars on top. Pick whoever you have on the phone. Their lost bids become a row of **project-name pills**. A pill reads *Take 5 Dickinson*, not a street fragment three other bids share. Hover a pill for the full name and address. When the GC talks in streets, the open bid's **address button** is right below. It opens Google Maps. Six reason chips:

***GC lost the project · Price too high · Went with another sub · Project died / on hold · Never finished bid · No answer***

Tap one, or press keys **1–6**. The bid is recorded and the next unexplained one opens. A builder's whole list clears in the length of the call. Type what they said in the note box first and it saves with the tap. That is a note like *about 6 grand over the winner*. {{button:outline|Skip →}} moves on without recording. Arrow keys move between bids. Explained pills turn green.

When the GC shares the actual numbers, keep them. Every lost-bid card has a **record the bid tab →** link. Once recorded, it is a **BID TAB** line with **edit**. The link opens the same capture as Waiting to hear: **low bid**, **high bid**, *"we were #2 from the bottom, of 6"*. A live line does the math on how far over the low we were. "About 6 grand over the winner" in a note is a story. The tab numbers are data you can compare across every loss.

Bids that already have a written note come **pre-suggested**. Say you typed "gc not awarded" while marking it lost in Edit Bid. The matching chip gets an amber ring and **Enter** confirms it. So already-explained bids clear as fast as you can press Enter. A note that could mean two different reasons suggests nothing. You decide.

The same six chips now live everywhere a bid gets marked lost. That is **Edit Bid**, the call-mode Lost flow, and the Bid Board's lost summary. So recording the reason once, anywhere, clears it here too.

You don't need a pop-up at all. On a builder card, every unsent or pending bid row has a small {{chip:red|Lost…}} action. It opens a two-tap panel right on the row. Type what they said, which is optional. Tap the reason. Done. Lost rows on the builder card and the By-status Lost table show their reason as a colored chip. Tap it to change. They show an amber {{chip:yellow|why? →}} when it still needs one.

One more quality-of-life fix. Jumping to a builder card from another lens used to leave that jump stuck in the page. Every later visit to By builder scrolled way down to it. Jumps are now one-shot. The page scrolls when you ask, and opens at the top of the call queue every time after.

:::example a Friday morning
Dale from Knight picks up. Six pills. "1, 1, 2" — with "6k over" typed before the 2 — "1, skip, 1". Knight's row goes green and the next builder is already open.
:::

## Review why you lose

Below the queue, the **Why we lost** rollup counts every categorized loss by reason, in count and dollars. It shows two loss rates. One is the raw rate. The other is the rate **excluding "GC lost the project"**. When your GC doesn't win, you never had a shot. That's not a competitive loss. The gap between those two numbers is how much of your loss rate isn't really yours.

Under the rollup sits ***Why we lose on price — what the tabs say***. It turns your recorded bid tabs into the numbers that change future bids. The headline reads *"when we lose on price, we're typically 7.4% over the low"*, with an honest coverage count. Three small charts follow. One shows **how far over the low** the misses run. One shows **where we land on the tab**. Mostly #2 means close races, not blowouts. One shows the **median by quarter**, so you can see the pencil sharpening. Then comes a **per-GC table sorted closest-first**. The top rows are GCs where a small price move flips outcomes. A "far off" row is a costing question, not a discount question. It follows the **bids by** estimator scope. It has its own time-range pills. It sharpens with every tab you record.

## Chase the bids you just sent

The **Waiting to hear** lens is the other half of the Friday calls. Instead of old lost bids, the queue is every **sent bid with no outcome yet**. The *recent* ones come first. That's where the feedback is still fresh and a bid tab is still gettable. The header says it all in one line. It says how many bids **need a chase**. That means nobody's talked to the GC in over a week. It says how many are still open, and their dollars. It reads *of 101 still open · 107 GC packets · Plumbing*. It says how many were **never called** since sending. Bids are counted once each. The GC-packet figure is the second number.

The left rail lists builders holding your open bids, most recently sent on top. It scrolls on its own when the list runs long. A builder whose bids were all touched this week shows **all caught up**. Pick one. Their pending bids become the same **street-name pills** as the Why we lost lens. Green means someone touched that bid in the last week. Plain means it's waiting on a chase. Each bid card shows the dollars, **when it was sent and how long ago**, and the due date. It shows the line that matters: **"Never contacted since sending"** in amber when nobody has followed up at all. The builder's phone number is tappable. The address opens Google Maps. **open their builder card →** jumps to the By builder lens for contacts, notes, and a full call session.

:::example the ask on every call
"Morning — we sent our number on Saginaw two weeks ago. Did it land? Are we in the hunt? Can I get the bid tab when it's out?" Tap through their pills with the arrow keys; {{button:outline|Skip →}} moves on.
:::

**The full picture rides beside the card.** On the right, or below on a phone, **The story so far** is the bid's whole conversation, newest first. It holds every logged call with *what they said* and who logged it. It holds notes added from the Bid Board. That is the same store, both directions. The letter-send is the anchor at the bottom. **show all N** unfolds the rest. Under it, **With <builder> lately** shows the latest word on each of the builder's *other* open bids. You're calling them once about all of it. So a line like *"budget review this week"* on a sibling bid is exactly what to mention while you have them. So is an amber *no contact since sent 7/2*. Tap a line and that bid opens on the card. Your own tap lands at the top of the story the moment you log it.

Log the answer without leaving the card. Use the **What happened?** chips, one tap per bid. They are ***Left message · Still pending · Bid tab received · Rebid / RFQ · Won · Lost…***.

**Won** takes the bid out of the queue. It leaves a green **You won it** strip at the top of the column with {{button:green|Open the job}}. One tap opens New Job filled from the bid. See [turn a won bid into a job](?g=turn-a-won-bid-into-a-job). On a multi-GC bid it asks first, naming the GCs it will mark lost.

**Bid tab received** opens a small capture first. It takes the tab in the words of the call: **low bid**, **high bid**, and *"we were #2 from the bottom, of 6"*. Money fields take shorthand like `230k`. Every field is optional. {{button:outline|Log without numbers}} is the old one-tap.

The tab may arrive **in writing**, as a GC email listing every number. Then flip the capture to {{button:outline|Paste the tab}} instead. Paste that project's lines. Every dollar amount becomes a rung on a ladder. Our line is auto-marked, where it says "Click". Tap another rung if not. The low, high and rank summary fills itself. The full bidder list stays on the bid as a ladder, ours highlighted with the gap to the next bid. As you type, a live line does the math on how far over the low we were. It catches numbers that don't add up. Recorded tabs stay on the bid card as one line with a low-to-high strip.

Every tap writes a bid note and stamps **Last Contact**. The pill goes green and the next bid opens. So the Bid Board and By builder queue stay current for free. On a multi-GC bid the tap remembers **which GC** you talked to. One rule to know: only real contacts move the Last Contact clock. A real contact is an entry with a method: call, text, email or in person. A plain note you write to yourself doesn't silence the gone-quiet nag.

Need to record a call after the fact? **Edit Bid → Log contact…** takes the method, the time, the GC, and what was said. The time can be backdated. The rest of the form keeps saving on its own around it. Logging a contact is its own record, never lost to a form save. **Lost…** reveals the same six reason chips as the Why we lost lens. A loss you learn about on the chase call gets its reason recorded on the spot. It never joins the unexplained backlog. Type **what they said** in the note box first and it saves with the tap.


## One bid, several GCs — every queue knows

A bid sent to several GCs shows up under **each** of them. That is in the Call queue, By builder's numbers, Why we lost and Waiting to hear. Since Bids by GC, **each GC's packet carries its own answer**. See *bid one project to multiple GCs*. Say a bid is won with Southern Post and lost with Burd. It is a **win in SPC's numbers and a loss in Burd's**. Hit rates, the *won · lost · pending* line and the map's builder focus all count the packet that went to *that* builder. Single-GC bids count exactly as before.

- When you mark one GC **won**, the other GCs you sent to are marked ***lost · GC lost the project*** for you. That works from the board, Followup, or a chase tap. A confirm names them before anything is written. It warns when the bid was marked Lost by hand and is about to flip to Won. They land tagged {{chip:gray|auto}} in Why we lost. You can tap a different reason any time. Nothing to triage. Setting the winner back to **waiting** undoes the whole thing. Siblings go back to waiting, and the bid goes back where it was.
- In **Why we lost**, a multi-GC entry shows a line under the address. It reads *Burd & Assoc.* {{chip:red|lost}} *★ $52,311 · sent 7/31 · also went to Southern Post* {{chip:green|won}}. The reason you tap is **that GC's**. The bid's overall outcome doesn't move.
- In **By status**, the bid shows one row per GC, each in the bucket that GC's answer puts it. The GC column names the row's GC with a quiet *also to …* line. The Lost row's reason is that GC's. The section headers count bids first. One reads *Not yet won or lost (101 bids · 107 GC packets)*. The Unsent header carries the trade name.
- In **Waiting to hear**, a GC that has answered drops off that builder's list while the others keep waiting. Touches stay per-bid, so a touch under any GC freshens every copy. A touch is Left message, Still pending and the like.
- A GC on the bid's **Also sent to** list may have no packet of its own. It got the same letter as the bid's GC. It rides with the bid's outcome. One reason still clears it everywhere. On the **Bid Board**, multi-GC bids show a line per GC under the row. They wear a {{chip:gray|+2 GCs}} chip for the Also-sent-to list.

## Print a call sheet

- {{button:outline|Call sheet}} on any card prints a one-pager. It holds the builder's people and numbers, their open bids with last-update ages, and ruled space for call notes.
- {{button:outline|Print call sheet}} in the toolbar prints the **whole queue** in call order. It is the classic clipboard for a phone morning.
- The per-person followup sheets still live on the **By status** lens. Pick a name, then {{button:outline|Print}} or {{button:outline|PDF}}.

## Jumping between lenses

On **By status**, the small **↗** next to a GC/Builder name jumps to that builder's card on **By builder**. It flashes amber so you can't lose it. Going the other way, tap the {{icon:help|magnifier}} next to any bid on a builder card. It opens that bid on the status lens.
