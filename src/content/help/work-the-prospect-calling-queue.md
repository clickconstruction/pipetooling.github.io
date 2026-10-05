---
title: work the prospect calling queue
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: prospects, follow up, cold call, calling queue, didn't answer, answered, converted, warmth, callback, next prospect, queue order
order: 70
---
**Prospects → Follow Up** is the calling workstation, and it deals you one prospect at a time. You make the call, log how it ended, and hit {{button:blue|Next Prospect →}}.

A prospect is a company that might become a customer. Everything you record feeds the Prospect List and the Activity report automatically. That means answers, notes and time on the phone.

## Make the call

The card at the top is who you're calling. It shows the company, the contact, and a big {{button:blue|📞 phone}} button that dials on tap. Chips beside it warn you when the prospect is {{chip:yellow|Due 183 days}} overdue. They also warn you when it shows {{chip:green|never called}}. That means no real call was ever logged.

## Log how the call ended

Every way a call can end sits in one row:

- {{button:amber|Didn't Answer}} or {{button:green|Answered}}: logs the call. Whatever you typed in the comment box is attached as the note. Pressing **Enter** in the comment box saves a plain note instead. That does not count as a call, so the prospect keeps its {{chip:green|never called}} chip. If you already hit Enter, you just click the outcome button next. It turns that fresh note into the call rather than adding a second line.
- {{button:outline|Can't reach}}: the number's dead or nobody ever picks up. The prospect leaves the queue but stays on the Prospect List.
- {{button:outline|Not a fit}}: they'll never be a plumbing customer.
- {{button:purple|Converted ✓}}: they became a customer. **Add customer** opens prefilled from the card, with the prospect already linked. Pressing {{button:blue|Save}} creates the customer. It moves the prospect under **Converted** on the Prospect List. Cancel changes nothing. Already added them from the Customers page? You use the **Started as a prospect?** field there instead. It gives the same result.

:::example Warmth takes care of itself
Every **Answered** raises the prospect's warmth by one — the {{chip:yellow|🔥 2}} chip shows it. You only need **Edit prospect** if you want to adjust it by hand.
:::

## Keep moving

- The **queue rail** on the right shows where you are, like *14 of 92*, and who's next. You tap any row to jump to it. On a phone, you tap **show order** instead.
- **Coldest / Never called** at the top of the rail picks the order: longest-since-contact first, or brand-new prospects first.
- The {{button:blue|Next Prospect →}} bar at the bottom advances without logging anything. Or you check **Automatically move to the next prospect when I click Didn't Answer** and let it advance itself.
- **Set callback** schedules a callback that shows on your Calendar and on this card.

## Two people, one prospect

Just *looking* at a prospect changes nothing for anyone else. Working it does. You work it when you tap the {{button:blue|📞 phone}} button or click into the comment box. Logging an outcome or setting a callback counts too. From that moment the prospect is marked as yours for the next **30 minutes**. It drops out of your colleagues' queues. You close the tab or move on, and the mark is released. If you forget, it simply expires.

:::example Someone got there first
If a colleague started the same prospect in the last half hour (say you both opened it from the Prospect List), your card shows a quiet {{chip:gray|Danny is calling this one}} chip. Nothing stops you — it's a heads-up, not a lock on the door — but check with them before you dial twice.
:::

## Where the numbers go

Your calls, answer rate, time on the phone, callbacks, and conversions roll up per person on **Prospects → Activity**. There is nothing extra to fill in.
