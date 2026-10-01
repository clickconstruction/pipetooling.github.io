---
title: send a GC our lien waiver
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: lien waiver, signs for the company, signer title, by, signature block, GC, general contractor, conditional, unconditional, progress, final, release of lien, he signs now, sign now, send to the GC, waiver PDF, 53.284, bill, pay app, send with the bill, bill tab, add waiver, waivers to sign, needs you, sign them, GC room, portal, what the GC sees, GC review, they hold, we owe
---
A GC often wants a lien waiver with each bill. The waiver says we give up our lien right for that payment. Texas has four forms. The app picks the right one from the bill, and the leader signs it in the app.

The work happens in five places. Each link opens that place.

- [Settings](/settings?tab=settings-jobs&focus=issuer.signerName) holds who signs for the company.
- The [Pipeline](/jobs?tab=stages) has the Release of Lien window on every billed job.
- The job's **Bill** tab shows each bill's two waivers.
- The leader's [Dashboard](/dashboard) holds the waivers waiting for his signature.
- [GC Review](/jobs?tab=stages&gcReview=1) shows what each GC holds and what we owe.

This guide is about our waiver to a GC. The waiver we collect from a sub is in [send a sub the right lien waiver](/help/send-a-lien-waiver).

## Send it with the bill

1. Open **Bill Customer** on the GC job's draft bill.
2. Look for the **Lien releases** strip. On a GC job it starts with a tick: **Send the lien waiver with this bill**. The tick is on.
3. Read the line under it. It names the form the bill picks and says why.
4. Send the bill as you always do.
5. The **Release of Lien** window opens on that bill once it has gone. Get it signed and send it, as below.

Untick the box if the GC does not want a waiver this time. The bill then goes alone.

## A bill already sent

1. Open the job and go to its **Bill** tab.
2. Every sent bill on a GC job shows two chips. The first is the conditional waiver. The second is the unconditional one.
3. The button beside them names the next move. {{button:outline|Add waiver ›}} means no waiver has gone yet. {{button:outline|Sign it ›}} means one waits for the leader. {{button:outline|Send it ›}} means one is signed but not sent. {{button:outline|Add the unconditional ›}} means the check has cleared.
4. Click it. The **Release of Lien** window opens on that bill.

{{gif:send-a-gc-our-lien-waiver-billtab.gif|The Bill tab: a sent bill ends with its two waiver chips and the door to the next move}}

## Open the waiver from the Pipeline

1. Go to **Jobs** and open the [Pipeline](/jobs?tab=stages).
2. Find the job's row under **Billed Awaiting Payment**. Click the heading if the section is folded.
3. Click the blue release of lien button in the row's small icon row. The **Release of Lien** window opens.
4. Check the green bill chips at the top. Pick the bill this waiver covers.

## Check the form the bill picked

Two switches at the top pick the form. The app sets both from the bill.

- **Conditional** or **Unconditional**. Conditional means the check has not cleared yet. It takes effect when the money lands. Unconditional means the money has settled.
- **Progress** or **Final**. Progress means more bills will follow. Final means this is the last bill on the job.

The line under the switches says why. It also shows the two facts it read from the bill. Change a switch if the bill has it wrong.

{{gif:send-a-gc-our-lien-waiver-window.gif|The Release of Lien window: the two switches, the why line, the leader's box, the page's foot}}

:::example The four forms
{{chip:yellow|Conditional · progress}} goes out with a bill that is not the last one.
{{chip:yellow|Conditional · final}} goes out with the last bill, before its check clears.
{{chip:green|Unconditional · progress}} goes out once a progress payment has settled.
{{chip:green|Unconditional · final}} goes out once the last payment has settled. It closes the job.
:::

Never send an unconditional form before the money has settled. Texas forbids requiring one before payment. The line under the switches reminds you.

## Set who signs for the company

Do this once. It fills the signer and his title on every waiver.

1. Open [Settings, Jobs & billing](/settings?tab=settings-jobs&focus=issuer.signerName). The link lands on the right line.
2. The **Physical invoice** block is open. Find the line **Signs for the company**. Type the leader's name.
3. Type his title in **His title**. For example, Owner. Or Responsible Master Plumber.
4. Click {{button:blue|Save}}.

The Release of Lien window now opens on him. His name and title print under the signature.

{{gif:send-a-gc-our-lien-waiver-settings.gif|Settings, Jobs & billing: the Physical invoice block with Signs for the company and His title}}

## Get the leader to sign

The **Signed by the leader** box names the leader who signs. It opens on the company's signer. Pick another leader from the list if this job needs one. There are two ways to sign.

- {{button:outline|Later, from his desk}} sends the waiver to his Dashboard. He signs it when he is next at his own screen.
- {{button:outline|✍ He signs now}} opens the signing pad right here. Use this when he is with you. Hand him the phone, or turn your screen to him.

When he signs now, he draws his signature with a finger or the mouse. He cannot type it. The pad locks to drawing whenever the signer is not the person signed in. This holds on every door into it, including {{button:outline|Sign it ›}} on the Bill tab. The record names him as the signer and names your device.

If you are the leader, the button reads {{button:outline|✍ Sign now}}.

{{gif:send-a-gc-our-lien-waiver-signnow.gif|He signs now: the pad opens with his name on it and only draws. Not now closes it without signing}}

## What prints under the signature

The foot of the waiver is one block.

- His drawn signature sits above a rule.
- Under the rule comes his name and the company on one line. For example, **Malachi Whites**, Click Plumbing and Electrical.
- His title comes next. It is left out when none is set.
- Then the day he signed.
- A grey sentence says how it was signed, by whom, when, and on whose screen. The two statutes sit under it.

The same block prints on the page, the PDF, the email and the GC's room.

## Sign several at once

A leader with waivers waiting sees a card on his [Dashboard](/dashboard). It reads **N lien waivers wait for your signature**.

1. Click {{button:outline|Sign them}}. The **Waivers to sign** seat opens.
2. The list is on the left. Each row names the GC, the job, the form and the amount.
3. Click a row. Its full page shows on the right. Read it.
4. Type or draw your signature under the page. Tick the box. Click {{button:blue|✍ Sign · send to the GC}}.
5. The waiver goes to the GC by email. The next row loads.

Untick **Send once signed** to sign without sending. The office sends it later from the job.

## Send it or download it

Once the waiver is signed, three buttons are ready.

- {{button:blue|Send to the GC}} emails the signed PDF to the GC's billing address. The subject names the bill, so it lands in the same thread. On a job with no GC it goes to the customer.
- {{button:outline|Download PDF}} saves the signed PDF to your computer.
- {{button:outline|Print}} opens the letter for a printer.

If the button is grey, the GC has no billing email on file. Add it on the GC's customer record and come back.

## On GC Review

Open a GC's row in [GC Review](/jobs?tab=stages&gcReview=1). Each bill ends with two chips. They read the same way as on the Bill tab.

- Green means done. {{chip:green|Conditional ✓ sent Sep 30}}
- Amber is the move before the call. {{chip:yellow|Conditional · none — send it}}
- Grey waits on the money. {{chip:gray|Unconditional · when paid}}

Click a chip to open the job. The Bill tab's door adds or sends the waiver.

{{gif:send-a-gc-our-lien-waiver-gcreview.gif|GC Review: open a GC's bills and each row ends with its two waiver chips}}

## What the GC sees

The GC's room has a **Lien waivers** section. It shows one row per bill they pay.

- The **Conditional** column shows the waiver that came with the bill. It is a dated PDF they can open.
- The **Unconditional** column shows the one that follows. It reads **when your check clears** until the money lands. Then it reads **on its way** while the leader signs. Then it is a PDF too.

Their bookkeeper can find every waiver there without calling the office. Open a GC's room from the globe on their Pipeline row. More on that room is in [share a customer their portal](/help/share-a-customer-their-portal).

## Where the waiver lives afterward

- In the **Release of Lien** window, under **Issued on this job**.
- In the **Bill Customer** window, in the **Lien releases** strip.
- On the leader's [Dashboard](/dashboard), in **Needs You**, when a conditional waiver's check has cleared and the unconditional one is owed.

Related guides: [give a customer a lien release](/help/give-a-customer-a-lien-release) and [understand how liens work and which lien tool to use](/help/understand-how-liens-work-and-which-lien-tool-to-use).
