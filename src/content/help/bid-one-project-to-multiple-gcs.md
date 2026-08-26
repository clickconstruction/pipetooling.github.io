---
title: bid one project to multiple GCs
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: bids, versions, GC, builder, cover letter, multiple GCs, packets, pricing, price option, alternate, won, lost, outcome, also sent to
order: 71
---
The one sentence: **versions draft this bid for different GCs; price options send more than one price to the same GC.** Each GC gets its own **packet** — counts, takeoff, prices, send date and answer — and inside a packet you choose which prices that GC receives.

## Add a GC

1. On the bid's **Counts / Takeoffs / Pricing / Cover Letter** pages, the strip at the top reads **Send to** — one group per GC, each showing whether it was sent and its ★ price. The bid's own GC comes first.
2. Press {{button:blue|＋ Add GC}}: pick the GC, choose which packet to **start from** (its counts, takeoff and prices are copied), and optionally name it — it defaults to the GC's name. The new GC joins the bid's *Also sent to* list on its own.
3. Inside a GC group, **+ version** adds another version to that packet. Its **Start from** picker lists every version on the bid — it opens on this packet's own version, but pick one from **another GC** to copy that version (counts, takeoff and prices) into this packet. The name pre-fills from the source; keep it or type your own. The ✎ on any version still renames it or points it at a different GC.

:::example Copy a version between GCs
Burd & Assoc. has an *Alternate 1* that Southern Post should get too? Press **+ version** on **Southern Post's** group, set *Start from* to **Burd & Assoc. · Alternate 1**, and create — Southern Post's packet gets its own copy, priced and editable on its own.
:::

:::example Not split yet?
A bid that has never been split shows one group — its GC — with *one packet*. The first **＋ Add GC** names the existing setup after the bid's GC and starts the new packet as a copy of it.
:::

## Choose what each GC receives

On **Pricing** (New), the Workbench shows the packet you're on: **This GC — Burd & Assoc.** and **Price options — what Burd & Assoc. receives**.

- The {{chip:green|★ base}} option is the price on that GC's letter — Cover Letter, Share, Print and the bid value all use it. {{button:outline|☆ Make base}} moves it, with a confirm.
- Every price card ends in a bar that answers **who sees this price**: green *★ The price on their letter*, blue *On their letter · alternate*, or gray *Only you see this*. The bar's links do the work — **offer as alternate** / **stop offering**, and **☆ make base**. The GC's chip on the Send to strip counts what they're getting: {{chip:blue|gets 2 prices}}.
- {{button:outline|＋ Add price}} asks what you want: **Another price for this GC** (name it; offer it right away or keep it to compare), **Another GC** (the same GC-first modal as the strip), or **Adopt an existing bid**.
- A packet that hasn't been priced yet says **No prices yet for Southern Post Construction** and offers to copy prices from a priced packet.

## Write each GC's letter

1. On **Cover Letter** (New), tabs above the form pick whose letter you're writing. Under **In Burd & Assoc.'s letter**, tick the packets that go in; each is **Base** or **Alternate**, and the prices you offered them show as alternate sub-rows.
2. The preview, {{button:blue|Print}} and the copy buttons follow the selected GC. Each letter holds **only that GC's packets and prices**, headed with their name and address — one builder never sees what another was quoted.
3. {{button:blue|Mark sent to Burd & Assoc.}} stamps that GC's packets with today's date and their ★ value. A GC whose packet has no prices yet gets a *No prices yet* note, and its Mark sent stays off.

## Track each GC's answer

- On the **Bid Board**, a bid with more than one packet shows a line per GC under its row — name · *sent 7/31* · ★ value · {{chip:gray|waiting…}} / {{chip:green|won}} / {{chip:red|lost}}. Set the answer there. A win rolls the bid up to **Won**; the bid only rolls to **Lost** once every GC you sent to has said no.
- **Followup → Full bid details** shows the same **Sent to — by GC** list with the same select.
- Each GC also gets its own call in the Followup queues, so a bid sent to three builders is three calls, not one.

## "Also sent to" — the same letter, no packet

Open **Edit Bid** and look under the GC/Builder picker: the **Also sent to** row lists every other GC this bid went out to. GCs with their own packet land here automatically; use {{button:outline|+ Add GCs}} for builders who got the **same letter** as the bid's GC without a packet of their own. The picker stays open while you tick — tick as many builders as you like, searching in between, then one press of {{button:blue|Add 3 GCs}} adds them all (Cancel or Esc backs out). Such a GC shows on the Send to strip, the board and Followup as *same letter as Southern Post Construction* — its answer is tracked with the bid. To track it separately, press **track separately** on the strip (it opens ＋ Add GC with that builder filled in) — the note under the row points there too.

## Tips

- Labor and cost are shared by the whole bid: switching packets changes revenue, not cost.
- Single-GC bids are unaffected: with one packet there are no GC tabs and no board lines, and everything works as before.
- Outside the bundle, the single letter always follows the **packet you're on**: switch packets and the letterhead, amount, and fixtures switch together.
