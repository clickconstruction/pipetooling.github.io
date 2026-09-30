---
title: bid one project to multiple GCs
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: bids, versions, GC, builder, cover letter, multiple GCs, packets, pricing, price option, alternate, won, lost, outcome, also sent to, job, import, winning GC
order: 71
---
The one sentence: versions draft this bid for different GCs. Price options send more than one price to the same GC.

A GC is a general contractor, the builder you send the bid to. Each GC gets its own **packet**. A packet holds the counts, the takeoff, the prices, the send date and the answer. Inside a packet you choose which prices that GC receives.

## Add a GC

1. Open the bid's **Counts / Takeoffs / Pricing / Cover Letter** pages. The strip at the top reads **Send to**. It shows one group per GC. Each group shows whether it was sent and its ★ price. The bid's own GC comes first.
2. Press {{button:blue|＋ Add GC}}. Pick the GC. Choose which packet to **start from**. Its counts, takeoff and prices are copied. You can name it. It defaults to the GC's name. The new GC joins the bid's *Also sent to* list on its own.
3. Inside a GC group, **+ version** adds another version to that packet. Its **Start from** picker lists every version on the bid. It opens on this packet's own version. Pick one from **another GC** to copy that version into this packet. The copy carries the counts, the takeoff and the prices. The name pre-fills from the source. Keep it or type your own. The ✎ on any version still renames it or points it at a different GC.

:::example Copy a version between GCs
Burd & Assoc. has an *Alternate 1* that Southern Post should get too? Press **+ version** on **Southern Post's** group, set *Start from* to **Burd & Assoc. · Alternate 1**, and create — Southern Post's packet gets its own copy, priced and editable on its own.
:::

:::example Not split yet?
A bid that has never been split shows one group — its GC — with *one packet*. The first **＋ Add GC** names the existing setup after the bid's GC and starts the new packet as a copy of it.
:::

## Choose what each GC receives

On **Pricing**, the tab marked New, the Workbench shows the packet you are on. It reads *This GC — Burd & Assoc.* and *Price options — what Burd & Assoc. receives*.

- The {{chip:green|★ base}} option is the price on that GC's letter. Cover Letter, {{button:green|Share with a teammate}}, Print and the bid value all use it. {{button:outline|☆ Make base}} moves it, with a confirm. **Share with a teammate** does exactly that. It hands the pricing package to someone on your team. It never sends anything to the GC and never marks the bid sent. Share while viewing a non-base price and it asks which to send. You can send the base, the one you are viewing, or **both** in one package.
- Every price card ends in a bar that answers **who sees this price**. Green reads *★ The price on their letter*. Blue reads *On their letter · alternate*. Gray reads *Only you see this*. The bar's links do the work. They are **offer as alternate**, **stop offering** and **☆ make base**. The GC's chip on the Send to strip counts what they are getting: {{chip:blue|gets 2 prices}}.
- {{button:outline|＋ Add price}} asks what you want. **Another price for this GC** lets you name it. Offer it right away or keep it to compare. **Another GC** opens the same GC-first modal as the strip. Or pick **Adopt an existing bid**.
- A packet that has not been priced yet says **No prices yet for Southern Post Construction**. It offers to copy prices from a priced packet.

## Write each GC's letter

1. On **Cover Letter**, the tab marked New, tabs above the form pick whose letter you are writing. An *Alternate* here is priced **in lieu of** the proposal. In lieu of means instead of. It is a whole different bid. A section the customer wants **with and without** is a different thing. See *offer an alternate on a bid*. Under **In Burd & Assoc.'s letter**, tick the packets that go in. Each is **Base** or **Alternate**. The prices you offered them show as alternate sub-rows.
2. The preview, {{button:blue|Print}} and the copy buttons follow the selected GC. Each letter holds **only that GC's packets and prices**. It is headed with their name and address. One builder never sees what another was quoted.
3. {{button:blue|Mark sent to Burd & Assoc.}} stamps that GC's packets with today's date and their ★ value. A GC whose packet has no prices yet gets a *No prices yet* note. Its Mark sent stays off.

**Every GC keeps its own sent record. The bid has one sent date, by one rule.** The bid's board date is the earliest send to any GC by any lane. A lane can be a Mark sent. It can be the bid room's first link send. On a bid with no versions, it can be the hand stamp. That is the day the bid left the building. It never moves when you mark a later GC. Sending a room link never moves a date you set by hand. On the Cover Letter of a bid that already has a date, the button reads {{button:blue|Move sent date to today}}. It asks first. That is the only thing that moves it. On every board and lens the bid counts **once**, whatever the number of GCs. The GC packets show up as the second figure. It reads *101 bids · 107 GC packets*. The board value stays with the bid's own GC's ★ base. So marking another GC's packet never overwrites it. In **Edit Bid**, the old single "Bid Date Sent" box is now a per-GC list on any bid with versions. Each GC shows its sent date with {{button:blue|Mark sent}}. **✎ Date…** sets or corrects when that letter actually went out, sent or phoned in. **Un-send…** removes one that was recorded by mistake. Un-sending the last GC puts the bid back on the Unsent/Working board.

## Track each GC's answer

- On the **Bid Board**, a bid with more than one packet shows a line per GC under its row. The line shows the name, then *sent 7/31*, then the ★ value, then the answer chip. The chip is {{chip:gray|waiting…}}, {{chip:green|won}} or {{chip:red|lost}}. Set the answer there. A win rolls the bid up to **Won**. The bid only rolls to **Lost** once every GC you sent to has said no.
- **Followup → Full bid details** shows the same *Sent to — by GC* list with the same select.
- **A win is one tap, but it is three changes. So the app says so first.** You can mark a GC {{chip:green|won}} in five places. They are Edit Bid, the board pill, Followup, Waiting to hear and the Call queue. Wherever you do it, a confirm reads *"Mark Southern Post Won? This marks the other GC (Burd & Assoc.) Lost — GC lost the project and the bid Won"*. If you had set the bid's Win/Loss to **Lost** by hand, it adds *"The bid is currently marked Lost by hand — it flips to Won"*. {{button:blue|Mark won}} does all of it. **Cancel** changes nothing.
- **Mis-tapped? {{button:outline|↩ waiting}} on the winner undoes the whole thing.** The GCs the win marked lost go back to {{chip:gray|waiting}}. The bid goes back to where it was, Not set or the Lost you had set. The toast spells it out: *"Southern Post back to waiting · Burd & Assoc. back to waiting · bid back to Not set."* A GC you marked lost yourself with a reason stays lost.
- Both moves leave a line in the bid's notes, so the story is readable later. The win reads *Marked Won via packet — Southern Post · siblings marked Lost: Burd & Assoc.* The undo reads *Won undone via packet — …*

:::example Marking Southern Post Won on a bid that also went to Burd
Mark Southern Post Won? This marks the other GC (Burd & Assoc.) Lost — GC lost the project and the bid Won. ↩ waiting on the winner puts all of it back.

{{button:outline|Cancel}} {{button:blue|Mark won}}
:::
- Each GC also gets its own call in the Followup queues. So a bid sent to three builders is three calls, not one.

## Turning the bid into a job

The fastest door is the win itself. Set the winner's pill to {{chip:green|won}}. You can do that on the Bid Board line, in Followup's *Sent to — by GC*, or in Edit Bid. A small **open the job →** link appears beside it. Edit Bid's **Job** block shows {{button:green|Open the job}}. One tap opens **New Job** filled from that GC's packet. The old way still works: **New Job → Import → the bid**. It runs the same fill. See *turn a won bid into a job*.

Once the job exists, the bid marks itself {{chip:blue|Started or complete}}. You will see a toast naming the bid for a few seconds as the job saves. Nobody has to go back and set it.

Either way the job needs to know **which GC gave you the job**. That GC becomes the job's GC/Builder. It is not automatically the bid's own.

- If one GC is already marked {{chip:green|won}}, the import uses them without asking.
- Otherwise a picker lists every GC on the bid. **Picking one records their Won.** The other sent, unanswered GCs are marked lost. Their GC lost the project. The job imports with that builder's name and contact info.
- If more than one GC reads won, the picker only chooses which packet this job is for. Nothing changes on the bid.
- **Cancel import** writes nothing and says so. It closes the New Job form it opened. No blank form is left behind.
- A bid that already has a job shows {{chip:green|J1007 opened from this bid}} in Edit Bid. Opening another asks first.

:::example Two builders, one winner
You bid the shell to Burd & Assoc. and Southern Post. Southern Post calls with the job: start **New Job → Import → the bid**, pick **Southern Post** in the ask, and the bid records their win (Burd reads lost) while the job opens with Southern Post as its GC.
:::

## "Also sent to": the same letter, no packet

Open **Edit Bid**. Under **GCs on this bid**, every GC renders as the same card. The card shows the name, the address and the contact chips. Its role is a small chip. {{chip:yellow|★ Bid's GC}} means the bid runs in their name. **change ▸** on the card swaps them. {{chip:blue|same letter}} means they got the bid GC's letter. Their answer is tracked with the bid. {{chip:green|own packet}} means their own prices and answer. Those land here on their own. Use {{button:outline|+ Add GCs}} for builders who got the **same letter** without a packet of their own. The picker stays open while you tick. Tick as many builders as you like, searching in between. Then one press of {{button:blue|Add 3 GCs}} adds them all. Cancel or Esc backs out. **A builder who is not in the system yet** does not make you leave. The picker's **＋ New GC** row opens the customer form right on top of Edit Bid. The new GC joins the bid the moment it saves. To give a same-letter GC its own packet, press **track separately** on the Send to strip. It opens ＋ Add GC with that builder filled in.

## Each GC's due date, submitted-to, and ITB links

Every GC card in Edit Bid carries its own **due date & time**, **submitted-to** contact, and **ITB links**. An ITB is an invitation to bid. Press **＋ due / submitted to / ITB** under a card. Or press **✎ edit** once something is set. Three builders, three deadlines.

The bid's board due date rolls up on its own. It becomes the **earliest due among the GCs you have not sent to yet**. Once a GC's letter goes out, their deadline stops driving the board. A bid where you never set per-GC dues keeps its hand-set due date exactly as before.

## Tips

- Labor and cost are shared by the whole bid. Switching packets changes revenue, not cost.
- Single-GC bids are unaffected. With one packet there are no GC tabs and no board lines. Everything works as before.
- Outside the bundle, the single letter always follows the **packet you are on**. Switch packets and the letterhead, amount, and fixtures switch together.
