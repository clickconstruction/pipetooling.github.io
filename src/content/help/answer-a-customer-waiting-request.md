---
title: answer a customer who sent a request from their portal
category: Office
roles: dev, assistant, controller, estimator
keywords: customer waiting, portal request, high priority, call customer, lower priority, raise priority, dispatch inbox, estimator inbox, banner, visit request, bid request
order: 23
---
A customer can send a request from their portal: a visit, a bid, or a GC asking for other dates. It lands in the inbox as a **customer waiting**, a person standing at the counter.

A GC is a general contractor. The request sits at the top of the list with a red rail and the number to call them at. A banner follows everyone in that inbox around the app until someone acts.

## Where it lands

- **Request a visit** and a GC's **Need other dates?** go to the **Dispatch inbox**. That inbox shows in Dispatch Mode → Inbox, the Dashboard's Teams Inbox, Quickfill, and Checklist → Review.
- **Ask us to bid** goes to the **Estimator inbox** when the estimating group has anyone in it. Otherwise it goes to Dispatch so it is never lost.

The Inbox badge on the Dispatch Mode footer breathes while a customer is waiting.

:::example What the row looks like
{{chip:red|Customer waiting · 14 min}} {{chip:gray|Portal · visit}}

**Jane Doe** · J812 · 1418 Bluebonnet Ln

"Water heater in the garage is leaking, there's water on the floor. Can someone come today? I'm home after 3."

Can be there: **Today after 3 pm** · Reach them at **(512) 555-0142**

{{button:green|📞 Call (512) 555-0142}}

{{button:outline|💬 Text}} {{button:outline|Lower priority ▾}} {{button:outline|✓ Close}}
:::

The header is the wait, not a label. It ticks, and turns darker red past 30 minutes. The request is the customer's own words in full. The number is the one they typed. When they left it blank, it is the one on the customer record, and the row says *from the customer record*.

## Call them

Tap **Call**. On a phone it dials. On a desktop it copies the number and says *Copied*, because a tel: link does nothing there. Either way the request is stamped. The row's footer and the banner change from **waiting** to **Sam called 2:14 pm** for everyone else. So four people do not all call Jane. A *📞 Called (512) 555-0142* note lands in the thread.

**Text** works the same way with an SMS link.

## Lower the priority

Reached them, booked Thursday, visit not done yet? **Lower priority ▾** takes the request off the banner without closing it. It asks why in one tap: **Scheduled**, **Not urgent**, **Spam or duplicate** or **Other**. You can add an optional note. It writes the pair into the thread:

:::example In the thread
**Sam** · Thu 2:31 pm
Priority lowered — Scheduled: Thu 9/12, 8–10 am, Sam going
:::

The row drops to its normal place in the list, oldest first. The banner ends for the whole team at once.

## Raise the priority

Any open request can become a customer waiting. Expand it and tap **Raise priority** next to *Activity / notes*. A tech's own "gas smell at J790" gets the same red rail, top slot and banner. It asks for an optional reason and writes *Priority raised — …* into the thread.

## Close it

**✓ Close** opens the thread. Add a note and **Add & Close** as usual. Closing ends the banner too. Who may call, lower, raise or close is the same set. On the Dispatch inbox it is Dispatch group members and devs. On the Estimator inbox it is estimating group members and devs.

## A question from a submittal room

A reviewer on a bid's review room can ask about a product right on the submittal. A submittal is the list of products you will install. The reviewer might be the customer's architect, say. It lands here like any customer waiting: {{chip:red|Dana Whitfield (architect) asked about WC-1 on B398 Rev 2}}. The question is the description. There is no number to call. Press {{button:blue|Answer on B398 ZZ Test · Rev 2 →}}. It opens the bid's **Submittals** tab, where the **Thread** panel shows the whole conversation and a reply box. Sending the answer posts it on the room as the company, never your name. It emails the person with their own room link. It closes this request with your answer as the note.

## The banner that follows you

While a customer is waiting, everyone in that inbox sees a strip above the top nav on every page. That means Jobs, Bids, Schedule, wherever they are:

:::example Waiting (red)
{{chip:red|● Jane Doe is waiting · 14 min}} Water heater leaking, wants someone today {{button:green|📞 Call}} {{button:outline|Open}}
:::

:::example After someone calls (amber)
{{chip:yellow|📞 Sam called Jane Doe 2:14 pm}} asks for a visit · still open {{button:outline|Open}}
:::

The minutes tick. **Call** on the strip does the same thing as Call on the row. It dials or copies, and stamps the request. **Open** goes to the inbox. That is Dispatch Mode's Inbox tab, or the Dashboard's Teams Inbox card for estimators. With two or more waiting, the oldest leads and the button reads *Open · +1 more*. On the inbox page itself the strip collapses to one quiet line. The request is already the first thing on screen there.

**Made the call yourself?** Once the strip reads *you called …*, a small **Hide for me** appears on it for you alone. It hides the strip on your device, since you have the row open. It hides it for nobody else. The request stays open, and on the whole team's strips, until someone lowers or closes it. If another person calls the customer later, the strip comes back for you too.

The Dashboard's **Needs you** card carries the same item at the very top: *Jane Doe is waiting · 14 min*. It is red while anyone is uncalled. It is amber once every open request has been called.

The strip ends for the whole team the moment the request is **lowered** or **closed**. Nothing lowers itself overnight. A person acts.
