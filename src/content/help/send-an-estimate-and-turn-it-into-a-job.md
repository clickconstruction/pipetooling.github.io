---
title: send an estimate and turn it into a job
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: estimate, new estimate, send to customer, tell the customer, text, email only, receipt, call, accept, approve, signature, opened, never opened, nudge, resend link, declined, no thanks, record a decline, create job from estimate, link existing job, create jobs automatically, change order, estimate loop, quote
order: 61
---
One estimate, start to finish. You write it, the customer gets a link, and the signed record becomes a job.

They open it or they do not. They sign or say no. Each leg has its own guide. This is the map of the whole loop.

:::example The loop
{{chip:gray|Draft}} → {{button:amber|Send to customer}} → {{chip:yellow|Sent · never opened}} / {{chip:gray|opened Tue}} → {{chip:green|Accepted}} or {{chip:red|Declined}} → {{button:blue|Create job from estimate}} → {{chip:green|J1234}}
:::

## 1. Write it

On **Estimates**, press {{button:blue|New estimate}}. A draft opens right away so you can start typing. If you leave it without typing anything, it removes itself. The first real edit keeps it and autosaves from then on. See [trust estimate drafts to save themselves](?g=trust-estimate-drafts-to-save-themselves).

The **numbered guide** beside the document lists what the customer's copy needs. On a phone it is a row of pills. The customer's copy needs a customer, lines and terms. The guide also lists what stays **Behind the scenes**: who gets notified, the project link and internal notes. Each step shows a green check or an amber dot with the reason it still wants attention. The send button under the guide says what is left, like *"2 steps left: cost lines · delivery"*. Want to offer a choice, like Repair versus Replace, or Good / Better / Best? See [offer options on an estimate](?g=offer-options-on-an-estimate). Flip **Editing / Customer view** to read exactly what the customer will read.

## 2. Send it

{{button:amber|Send to customer}} opens the **Tell the customer** sheet. Nothing is sent until you press.

1. Read **What goes**. The email is ticked, with the address it goes to. The text is ticked when the customer has a number on file.
2. Read the text in the orange box. Change any word. Keep the word link in braces where you want the estimate's link.
3. Press {{button:green|Send both to Dana}}. The email goes first. Then the text goes with the same link.

Press **Preview** beside the email or the text to see it as Dana will. The sheet stays open under it. The link in the text preview is a sample. The real one fills in when the email goes.

Press **Email only** to skip the text this time. Press **Skip** to send nothing.

:::example The text as it goes
Dana, this is Rosa with Click Plumbing. Your estimate for Whitfield water heater is ready, $1,850.00. Open it to approve the option you want: clicktooling.com/estimate/…
:::

After the send, the sheet shows what went and when. Under it, **Call Dana to talk it through?** with the words to say. Press {{button:blue|Call}} to dial, or **Done**.

Under the words, the sheet says whose script it is. Press **Change the script in Settings** to write the office's own, in English and Spanish. It lands on the Estimate step of the Residential customer flow.

The estimate keeps a **What went** card after that. It lists the email with its time and each text that carried the link. Press **Open the thread** to read the text where it landed. When no text went, the card says why.

A send that cannot finish says so in the sheet. A red band names the reason and your typed words stay. Press {{button:green|Try again}} when you fixed the reason, or **Skip** to leave it. If the estimate already went, the band says when it went. The button then reads {{button:green|Send the link again}}. That press emails a fresh link and texts it. The old link stops working.

A change order, or an estimate with a $0 total, keeps the old question: **Send to pat@example.com?** The customer gets one letter with a {{button:amber|Review & accept the estimate}} button either way. See [schedule a job and tell the customer](/help/schedule-a-job-and-tell-the-customer) for the same sheet on a booking.

## 3. Watch the row

The **Pipeline**'s Sent row tells you what happened on the other end:

- {{chip:gray|never opened · sent 3d ago}} means nobody has clicked the link. After a week it turns {{chip:yellow|never opened · sent 9d ago — nudge?}}. Check the address, then call.
- {{chip:gray|opened Tue · quiet 2d}} means a person looked. Give them room. After a week of quiet it asks for a nudge too.

Your own **Open customer link** from the office does not count as an open. Mail-server prefetches are filtered out. For the full chip list and what counts, see [tell if a customer opened an estimate, and record a no](?g=tell-if-a-customer-opened-an-estimate-and-record-a-no).

**The email never came?** Open the sent estimate, then **Customer activity**, then {{button:blue|Resend link}}. The customer gets the same letter with a brand-new link. The old one stops working. The new link shows once with {{button:outline|Copy link}} so you can text it instead. Pricing past its good-through date cannot be resent. Start a new estimate.

## 4a. They say no

Under Approve on their page is a quiet **No thanks**. If they use it, the row moves to a **Declined** section at the bottom of the Pipeline. It reads {{chip:gray|Declined by customer · 2h ago}}. Their reason, if any, is in Customer activity. Heard the "no" on the phone? On the sent estimate press {{button:outline|Record a decline (phone / in person)}}. Pick how you heard, add a sentence, then {{button:red|Mark declined}}. A decline is final for that quote number. A change of heart is a **New estimate**.

## 4b. They sign

The customer presses {{button:blue|Approve}}. When they picked an option it reads *Approve "Better" — $6,120*. They type or draw their name. They tick **I agree to sign electronically**. The quiet line above it says a typed or drawn signature counts like ink and that paper is available. **How electronic signing works ▸** opens the ESIGN / Texas UETA detail, the laws on electronic signatures. They tick the terms box, and the estimate is **Accepted**. Two things happen at once:

- **The office gets an email.** It is a **Signed** notice naming who signed, the estimate and the total. It carries {{button:blue|Open the signed record}} and {{button:amber|Create the job}}. Who receives it, and how to add people: [get notified when a bid or estimate is signed](?g=get-notified-when-a-bid-or-estimate-is-signed).
- **The record locks.** The signature is stored on the estimate: name, time and IP address. So are the exact consent words they saw. The record's facts line reads *Consent v1 · en · ESIGN Act · Tex. UETA ch. 322*. The customer's link now opens on a thank-you page instead of the Approve button.

## 5. Make it a job

On the accepted record's **Job** block, press {{button:blue|Create job from estimate}}. Or go straight from the email's {{button:amber|Create the job}}. New Job opens with the customer, address and the accepted lines already in as Specific Work. The **Job name** is filled in for you. The estimate may still carry its stock heading, like "Estimate for Kimberly Coe". That heading is for the customer's paper, not the Pipeline. Then the job is named for the customer. The work is added when the estimate has one line that names it: {{chip:gray|Kimberly Coe — Pretest}}. Several lines, or a line like "Custom Service Visit", give the customer's name alone. A heading you wrote for the work is used as is. Change it if you like, then press Create. The job is linked to the estimate. It is also linked to the bid, if the estimate came from one. Then the Bid Board shows a {{chip:green|J1234}} chip. Already typed the job by hand? Use **Link existing job** in the same window instead of making a twin.

Prefer not to click at all? **Settings → Emails & reports → Signed agreements → Create jobs automatically** makes the job the moment they sign. It is named the same way. It has two guardrails. It will not duplicate a same-customer, same-name, same-value job opened in the last 90 days. And a **change order never becomes a job**. It is applied to the job it changes.

:::example A Tuesday in the office
Estimate #482 goes out at 9:10. By Thursday the row reads *opened Wed · quiet 1d*. Friday the "Signed" email lands; Wendi taps **Create the job**, checks the crew, presses Create — J1234 is on the Pipeline in {{chip:blue|Working}} with the estimate's lines as its scope.
:::

## After the job exists

Scope changes mid-job go out as a **change order** on the same rails. Same send, same signature page. Then {{button:outline|Apply to job}} moves the net change onto the job. See [write a change order and send it for signature](?g=write-a-change-order). A job that came from a bid rather than an estimate has its own door. See [turn a won bid into a job](?g=turn-a-won-bid-into-a-job).
