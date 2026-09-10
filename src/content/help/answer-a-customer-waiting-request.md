---
title: answer a customer who sent a request from their portal
category: Office
roles: dev, assistant, controller, estimator
keywords: customer waiting, portal request, high priority, call customer, lower priority, raise priority, dispatch inbox, estimator inbox, banner, visit request, bid request
order: 23
---
When a customer sends a request from their portal — a visit, a bid, or a GC asking for other dates — it lands in the inbox as a **customer waiting**: a person standing at the counter. It sits at the top of the list with a red rail, the number to call them at, and a banner that follows everyone in that inbox around the app until someone acts.

## Where it lands

- **Request a visit** and a GC's **Need other dates?** go to the **Dispatch inbox** (Dispatch Mode → Inbox, the Dashboard's Teams Inbox, Quickfill, Checklist → Review).
- **Ask us to bid** goes to the **Estimator inbox** when the estimating group has anyone in it; otherwise it goes to Dispatch so it is never lost.

The Inbox badge on the Dispatch Mode footer breathes while a customer is waiting.

:::example What the row looks like
{{chip:red|Customer waiting · 14 min}} {{chip:gray|Portal · visit}}

**Jane Doe** · J812 · 1418 Bluebonnet Ln

"Water heater in the garage is leaking, there's water on the floor. Can someone come today? I'm home after 3."

Can be there: **Today after 3 pm** · Reach them at **(512) 555-0142**

{{button:green|📞 Call (512) 555-0142}}

{{button:outline|💬 Text}} {{button:outline|Lower priority ▾}} {{button:outline|✓ Close}}
:::

The header is the wait, not a label — it ticks, and turns darker red past 30 minutes. The request is the customer's own words in full. The number is the one they typed, or the one on the customer record when they left it blank ("from the customer record").

## Call them

Tap **Call**. On a phone it dials; on a desktop it copies the number (a tel: link does nothing there) and says *Copied*. Either way the request is stamped — the row's footer and the banner change from **waiting** to **Sam called 2:14 pm** for everyone else, so four people don't all call Jane. A `📞 Called (512) 555-0142` note lands in the thread.

**Text** works the same way with an SMS link.

## Lower the priority

Reached them, booked Thursday, visit not done yet? **Lower priority ▾** takes the request off the banner without closing it. It asks why in one tap — **Scheduled** · **Not urgent** · **Spam or duplicate** · **Other** — plus an optional note, and writes the pair into the thread:

:::example In the thread
**Sam** · Thu 2:31 pm
Priority lowered — Scheduled: Thu 9/12, 8–10 am, Sam going
:::

The row drops to its normal place in the list (oldest first) and the banner ends for the whole team at once.

## Raise the priority

Any open request can become a customer waiting: expand it and tap **Raise priority** next to *Activity / notes*. A tech's own "gas smell at J790" gets the same red rail, top slot and banner. It asks for an optional reason and writes *Priority raised — …* into the thread.

## Close it

**✓ Close** opens the thread; add a note and **Add & Close** as usual. Closing ends the banner too. Who may call, lower, raise or close is the same set: Dispatch group members and devs on the Dispatch inbox, estimating group members and devs on the Estimator inbox.

## The banner that follows you

While a customer is waiting, everyone in that inbox sees a strip above the top nav on every page — Jobs, Bids, Schedule, wherever they are:

:::example Waiting (red)
{{chip:red|● Jane Doe is waiting · 14 min}} Water heater leaking, wants someone today {{button:green|📞 Call}} {{button:outline|Open}}
:::

:::example After someone calls (amber)
{{chip:yellow|📞 Sam called Jane Doe 2:14 pm}} asks for a visit · still open {{button:outline|Open}}
:::

The minutes tick. **Call** on the strip does the same thing as Call on the row (dials or copies, and stamps the request). **Open** goes to the inbox — Dispatch Mode's Inbox tab, or the Dashboard's Teams Inbox card for estimators. With two or more waiting, the oldest leads and the button reads *Open · +1 more*. On the inbox page itself the strip collapses to one quiet line, since the request is already the first thing on screen.

The Dashboard's **Needs you** card carries the same item at the very top — *Jane Doe is waiting · 14 min* — red while anyone is uncalled, amber once every open request has been called.

The strip ends for the whole team the moment the request is **lowered** or **closed**. Nothing lowers itself overnight; a person acts.
