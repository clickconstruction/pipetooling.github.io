---
title: tell if a customer opened an estimate, and record a no
category: Office
roles: dev, master_technician, assistant, controller, estimator, superintendent
keywords: estimate opened, never opened, quiet, nudge, follow up, declined, decline, no thanks, customer said no, record a decline, phone, declined bucket, sent estimates, pipeline
order: 65
---
The Estimates **Pipeline** answers the morning question on the row itself: *did they even open it?* — and when the answer is a "no", there is finally somewhere to put it.

## Read the Sent row

Every estimate in **Sent** wears one chip that folds the customer's activity into the age of the send:

- {{chip:gray|never opened · sent 3d ago}} — the link has not been opened by anyone. If it's been a while, check the email address before you chase.
- {{chip:yellow|never opened · sent 9d ago — nudge?}} — a week or more and nobody has looked. This is the one to call; they may never have received it.
- {{chip:gray|opened Tue · quiet 2d}} — a person opened it (Tuesday) and has been quiet since. Give them a little room.
- {{chip:yellow|opened 8/28 · quiet 8d — nudge?}} — they looked, then went quiet for a week. A friendly follow-up fits here.
- {{chip:gray|opened today}} — they're looking right now. Sit tight.

Hover the chip for how many times it was opened. Change orders with a **Response requested by** date still go red when that date passes, opened or not.

:::example What counts as "opened"
Opening the link and looking at an option both count. Mail-server prefetches — several different addresses hitting the link in the first minute after you send — are filtered out, so a burst of "views" the second you press Send is not a customer. Your own **Open customer link** from the office does not count either.
:::

## When the customer says no

**On their side:** under {{button:blue|Approve}} on the acceptance page there is a quiet **No thanks** link. It opens a small panel — *Not going ahead?* — with an optional reason and {{button:outline|Decline this estimate}}. Nothing else is asked of them.

**On your side:** the estimate moves out of **Sent** into a **Declined** section at the bottom of the Pipeline (it only appears when there is something in it), and the row reads {{chip:gray|Declined by customer · 2h ago}}. Open it and **Customer activity** shows the line *Declined by customer — "went with another bid"* if they left a reason.

## Record a "no" you heard on the phone

The customer called or told you in person. Open the sent estimate and, under the customer-link buttons, press {{button:outline|Record a decline (phone / in person)}}.

1. **How did you hear?** — Phone call, In person, Email, Text message, Other.
2. **Note** (optional) — what they said, in a sentence. *"Going with their brother-in-law; call back in the spring."*
3. {{button:red|Mark declined}}.

The row moves to **Declined** wearing {{chip:gray|Declined — office heard it by phone · just now}}, and the note sits in Customer activity for whoever picks the file up next.

:::example It cannot be un-declined
A decline is final for that quote number — the same as the customer pressing No thanks. If they change their mind, start a **New estimate** from the Estimates page. The declined one stays in the Ledger under *Include superseded & declined* as the record of what was offered.
:::

## What the Ledger shows

Declined estimates drop out of the Ledger by default; toggle **Include superseded & declined** to see them. They never count toward *Outstanding sent*, so your open-quotes money stops carrying dead weight.
