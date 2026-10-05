---
title: tell if a customer opened an estimate, and record a no
category: Office
roles: dev, master_technician, assistant, controller, estimator, superintendent
keywords: estimate opened, never opened, quiet, nudge, follow up, declined, decline, no thanks, customer said no, record a decline, phone, declined bucket, sent estimates, pipeline
order: 65
---
The Estimates **Pipeline** shows right on the row whether the customer opened your estimate. When the customer says no, there is finally somewhere to put it.

## Read the Sent row

Every estimate in **Sent** wears one chip. The chip shows what the customer has done since you sent it, and how long ago:

- {{chip:gray|never opened · sent 3d ago}}: the link has not been opened by anyone. If it's been a while, check the email address before you chase.
- {{chip:yellow|never opened · sent 9d ago — nudge?}}: a week or more and nobody has looked. This estimate is the one to call. The customer may never have received it.
- {{chip:gray|opened Tue · quiet 2d}}: a person opened it on Tuesday and has been quiet since. Give them a little room.
- {{chip:yellow|opened 8/28 · quiet 8d — nudge?}}: they looked, then went quiet for a week. A friendly follow-up fits here.
- {{chip:gray|opened today}}: they're looking right now. Sit tight.

You hover the chip to see how many times it was opened. A change order is a priced change to work already agreed. A change order with a **Response requested by** date still goes red when that date passes, opened or not.

:::example What counts as "opened"
Opening the link and looking at an option both count. Mail-server prefetches — several different addresses hitting the link in the first minute after you send — are filtered out, so a burst of "views" the second you press Send is not a customer. Your own **Open customer link** from the office does not count either.
:::

## When the customer says no

**On their side:** there is a quiet **No thanks** link under {{button:blue|Approve}} on the acceptance page. The link opens a small panel, *Not going ahead?*, with an optional reason and {{button:outline|Decline this estimate}}. Nothing else is asked of them.

**On your side:** the estimate moves out of **Sent** into a **Declined** section at the bottom of the Pipeline. That section only appears when there is something in it. The row reads {{chip:gray|Declined by customer · 2h ago}}. If the customer left a reason, you open the estimate and **Customer activity** shows it. The line reads *Declined by customer — "went with another bid"*.

## Record a "no" you heard on the phone

The customer called or told you in person. You open the sent estimate. Under the customer-link buttons, you press {{button:outline|Record a decline (phone / in person)}}.

1. **How did you hear?** You pick Phone call, In person, Email, Text message or Other.
2. **Note** is optional. You write what they said, in a sentence. *"Going with their brother-in-law; call back in the spring."*
3. You press {{button:red|Mark declined}}.

The row moves to **Declined** wearing {{chip:gray|Declined — office heard it by phone · just now}}. The note sits in Customer activity for whoever picks the file up next.

:::example It cannot be un-declined
A decline is final for that quote number — the same as the customer pressing No thanks. If they change their mind, start a **New estimate** from the Estimates page. The declined one stays in the Ledger under *Include superseded & declined* as the record of what was offered.
:::

## What the Ledger shows

Declined estimates drop out of the Ledger by default. You toggle **Include superseded & declined** to see them. Declined estimates never count toward *Outstanding sent*, so your open-quotes money stops carrying dead weight.
