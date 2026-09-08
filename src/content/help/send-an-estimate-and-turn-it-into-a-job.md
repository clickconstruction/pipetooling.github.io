---
title: send an estimate and turn it into a job
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: estimate, new estimate, send to customer, accept, approve, signature, opened, never opened, nudge, resend link, declined, no thanks, record a decline, create job from estimate, link existing job, create jobs automatically, change order, estimate loop, quote
order: 61
---
One estimate, start to finish: you write it, the customer gets a link, they open it (or don't), they sign (or say no), and the signed record becomes a job. Each leg has its own guide; this is the map of the whole loop.

:::example The loop
{{chip:gray|Draft}} → {{button:amber|Send to customer}} → {{chip:yellow|Sent · never opened}} / {{chip:gray|opened Tue}} → {{chip:green|Accepted}} or {{chip:red|Declined}} → {{button:blue|Create job from estimate}} → {{chip:green|J1234}}
:::

## 1. Write it

On **Estimates**, press {{button:blue|New estimate}}. A draft opens right away so you can start typing — and if you leave it without typing anything, it removes itself; the first real edit keeps it and autosaves from then on ([trust estimate drafts to save themselves](?g=trust-estimate-drafts-to-save-themselves)).

The **numbered guide** beside the document (a row of pills on a phone) lists what the customer's copy needs — customer, lines, terms — and what stays **Behind the scenes** (who gets notified, the project link, internal notes). Each step shows a green check or an amber dot with the reason it still wants attention; the send button under the guide says what's left ("2 steps left: cost lines · delivery"). Want to offer a choice — Repair vs. Replace, Good / Better / Best? See [offer options on an estimate](?g=offer-options-on-an-estimate). Flip **Editing / Customer view** to read exactly what the customer will read.

## 2. Send it

{{button:amber|Send to customer}} asks one question — **Send to pat@example.com?** — so you see who is about to get it (a $0 total is called out in the same ask). Confirm, and the customer gets one letter with a {{button:amber|Review & accept the estimate}} button; nothing is sent until you confirm. What the letter looks like, and how to preview it first: [see the email a customer gets with an estimate](?g=see-the-email-a-customer-gets-with-an-estimate).

## 3. Watch the row

The **Pipeline**'s Sent row tells you what happened on the other end:

- {{chip:gray|never opened · sent 3d ago}} — nobody has clicked the link. After a week it turns {{chip:yellow|never opened · sent 9d ago — nudge?}} — check the address, then call.
- {{chip:gray|opened Tue · quiet 2d}} — a person looked. Give them room; after a week of quiet it asks for a nudge too.

Your own **Open customer link** from the office doesn't count as an open, and mail-server prefetches are filtered out. Full chip list and what counts: [tell if a customer opened an estimate, and record a no](?g=tell-if-a-customer-opened-an-estimate-and-record-a-no).

**The email never came?** Open the sent estimate → **Customer activity** → {{button:blue|Resend link}}. The customer gets the same letter with a brand-new link (the old one stops working), and the new link shows once with {{button:outline|Copy link}} so you can text it instead. Pricing past its good-through date can't be resent — start a new estimate.

## 4a. They say no

Under Approve on their page is a quiet **No thanks**; if they use it, the row moves to a **Declined** section at the bottom of the Pipeline reading {{chip:gray|Declined by customer · 2h ago}}, with their reason (if any) in Customer activity. Heard the "no" on the phone? On the sent estimate press {{button:outline|Record a decline (phone / in person)}}, pick how you heard, add a sentence, {{button:red|Mark declined}}. A decline is final for that quote number — a change of heart is a **New estimate**.

## 4b. They sign

The customer presses {{button:blue|Approve}} (or *Approve "Better" — $6,120* when they picked an option), types or draws their name, ticks **I agree to sign electronically** (the quiet line above it says a typed or drawn signature counts like ink and that paper is available — **How electronic signing works ▸** opens the ESIGN / Texas UETA detail), ticks the terms box, and the estimate is **Accepted**. Two things happen at once:

- **The office gets an email** — a **Signed** notice naming who signed, the estimate and the total — with {{button:blue|Open the signed record}} and {{button:amber|Create the job}}. Who receives it, and how to add people: [get notified when a bid or estimate is signed](?g=get-notified-when-a-bid-or-estimate-is-signed).
- **The record locks.** The signature (name, time, IP) is stored on the estimate, with the exact consent words they saw (the record's facts line reads *Consent v1 · en · ESIGN Act · Tex. UETA ch. 322*), and the customer's link now opens on a thank-you page instead of the Approve button.

## 5. Make it a job

On the accepted record's **Job** block — or straight from the email's {{button:amber|Create the job}} — press {{button:blue|Create job from estimate}}. New Job opens with the customer, address and the accepted lines already in as Specific Work; press Create and the job is linked to the estimate (and to the bid, if the estimate came from one — the Bid Board shows a {{chip:green|J1234}} chip). Already typed the job by hand? Use **Link existing job** in the same window instead of making a twin.

Prefer not to click at all? **Settings → Emails & reports → Signed agreements → Create jobs automatically** makes the job the moment they sign, with two guardrails: it won't duplicate a same-customer, same-name, same-value job opened in the last 90 days, and a **change order never becomes a job** — it is applied to the job it changes.

:::example A Tuesday in the office
Estimate #482 goes out at 9:10. By Thursday the row reads *opened Wed · quiet 1d*. Friday the "Signed" email lands; Wendi taps **Create the job**, checks the crew, presses Create — J1234 is on the Pipeline in {{chip:blue|Working}} with the estimate's lines as its scope.
:::

## After the job exists

Scope changes mid-job go out as a **change order** on the same rails — same send, same signature page, then {{button:outline|Apply to job}} moves the net change onto the job ([write a change order and send it for signature](?g=write-a-change-order)). And a job that came from a *bid* rather than an estimate has its own door: [turn a won bid into a job](?g=turn-a-won-bid-into-a-job).
