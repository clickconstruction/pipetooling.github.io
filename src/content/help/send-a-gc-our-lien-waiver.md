---
title: send a GC our lien waiver
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: lien waiver, six steps, step 1, step 5, change a detail, amount, why less than the bill, still owed, paid so far, signs for the company, signer title, by, signature block, GC, general contractor, conditional, unconditional, progress, final, release of lien, he signs now, sign now, send to the GC, waiver PDF, 53.284, bill, pay app, send with the bill, bill tab, add waiver, waivers to sign, needs you, sign them, GC room, portal, what the GC sees, GC review, they hold, we owe
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
2. Every sent bill on a GC job shows two chips. The first is the conditional waiver. The second is the unconditional one. They sit on their own line at the right, with the bill's ⋯ at the end. They stay grey until a waiver on that bill is under way.
3. The button beside them names the next move. {{button:outline|Add waiver ›}} means no waiver has gone yet. {{button:outline|Sign it ›}} means one waits for the leader. {{button:outline|Send it ›}} means one is signed but not sent. {{button:outline|Add the unconditional ›}} means the check has cleared.
4. Click it. The **Release of Lien** window opens on that bill.

{{gif:send-a-gc-our-lien-waiver-billtab.gif|The Bill tab: the waiver row sits at the right. Its door opens the Release of Lien window.}}

## From View bill

**View bill** opens a sent bill. On a GC job it starts with a card of the bill's papers. The first row is the **Lien waiver** row.

1. Read the row's headline. It names the waiver and the money. For example, **Conditional for $4,720 not sent**.
2. Read the line under it. A bill past its due date says how many days. A GC often waits for the waiver before it pays.
3. Read the two dots. The first is the conditional waiver. The second is the unconditional one. Amber means owed now. Green means sent.
4. Click the row's button. It names the next move. {{button:blue|Add waiver}}, {{button:blue|Sign it}}, {{button:blue|Send to the GC}} or {{button:blue|Add the unconditional}}. The **Release of Lien** window opens on this bill.

The GC may have no email for waivers yet. The row then offers the email the bill went to. Click **Use** and the address is saved on the GC's customer record. It never replaces an email someone typed there.

The **Contract** and **Sub work order** rows sit under the waiver. Their buttons are plain while a waiver move is owed.

:::example The waiver row on View bill
{{chip:yellow|Conditional for $4,720 not sent}} {{button:blue|Add waiver}}
{{chip:yellow|Signed by Malachi. Not sent yet.}} {{button:blue|Send to the GC}}
{{chip:green|Both waivers sent}} {{button:outline|View}}
:::

## Open the waiver from the Pipeline

1. Go to **Jobs** and open the [Pipeline](/jobs?tab=stages).
2. Find the job's row under **Billed Awaiting Payment**. Click the heading if the section is folded.
3. Click the blue release of lien button in the row's small icon row. The **Release of Lien** window opens.
4. Follow the six steps down the left side, as below.

## Follow the six steps

The window walks you down its left side in six steps. A line with an arrow joins each step to the next.

1. **Pick the bills.** Click the bill or bills this waiver is for.
2. **Check the form.** The app picks it from the bills.
3. **Check the amount.** The box under it shows the math.
4. **Check the details.** They come from the job. Click {{button:outline|Change a detail}} only if one is wrong.
5. **Get it signed.** Pick how the leader signs.
6. **Send it to the GC.** It opens once he has signed.

A green tick means a step is done. The blue number is the step to do now. An amber mark means a step needs a fix, and the steps after it wait. The footer always says which step you are on.

The page on the right stays in view while you work. It marks the part the current step fills.

:::example The steps on a job
{{chip:green|1 · Pick the bills · Done}}
{{chip:green|4 · Check the details · Done}}
{{chip:blue|5 · Get it signed · You are here}}
{{chip:gray|6 · Send it to the GC · Opens once he signs}}
:::

## Check the form the bill picked

Two switches in step 2 pick the form. The app sets both from the bill.

- **Conditional** or **Unconditional**. Conditional means the check has not cleared yet. It takes effect when the money lands. Unconditional means the money has settled.
- **Progress** or **Final**. Progress means more bills will follow. Final means this is the last bill on the job.

The line under the switches says why. It also shows the two facts it read from the bill. Change a switch if the bill has it wrong.

{{gif:send-a-gc-our-lien-waiver-window.gif|The Release of Lien window: the six steps down the left and the page beside them}}

:::example The four forms
{{chip:yellow|Conditional · progress}} goes out with a bill that is not the last one.
{{chip:yellow|Conditional · final}} goes out with the last bill, before its check clears.
{{chip:green|Unconditional · progress}} goes out once a progress payment has settled.
{{chip:green|Unconditional · final}} goes out once the last payment has settled. It closes the job.
:::

Never send an unconditional form before the money has settled. Texas forbids requiring one before payment. The line under the switches reminds you.

## Why the amount is less than the bill

The amount is often smaller than the bill. The window shows the math under the **Amount** box.

- Each bill chip says what is still owed. For example, {{chip:green|#1 · $9,022.49 owed}} is part of a $26,800 bill.
- The box lists the bill, then each payment on it with its date, then the total. The total is the amount on the waiver.
- A conditional waiver covers the money still to come. That is the bill less what was paid.
- An unconditional progress waiver covers the money already paid.
- An unconditional final waiver covers the whole bill. The box says **Not yet** while money is still owed.

:::example Bill #1 on a job
Bill #1 · billed Jul 15 · $26,800.00
Check · Sep 14 · − 11,700.00
Check · Sep 28 · − 6,077.51
**Still owed on bill #1 · $9,022.49**
:::

Two notes can show in the steps above the box.

- An amber note in step 1 says the bill is already waived. Another live waiver covers it, so a second one would give up the same money twice. The steps after it wait. When money is paid and not waived yet, click {{button:blue|Waive the $17,777.51 already paid instead ›}}. Click {{button:outline|Open the signed one ›}} to see the other waiver. Click {{button:outline|Discard this draft}} to drop the new one. Click **Make it anyway** only when the app has it wrong.
- A blue note in step 2 says money is paid and not waived yet. The GC is owed an unconditional progress waiver for it. Click {{button:outline|Waive the $17,777.51 paid ›}} to switch the window to that form.

If you type over the amount, the window shows what the bills say. Click {{button:outline|Use $9,022.49}} to put it back. Hover the box to see the amount marked on the page.

## Set who signs for the company

Do this once. It fills the signer and his title on every waiver.

1. Open [Settings, Jobs & billing](/settings?tab=settings-jobs&focus=issuer.signerName). The link lands on the right line.
2. The **Physical invoice** block is open. Find the line **Signs for the company**. Type the leader's name.
3. Type his title in **His title**. For example, Owner. Or Responsible Master Plumber.
4. Click {{button:blue|Save}}.

The Release of Lien window now opens on him. His name and title print under the signature.

{{gif:send-a-gc-our-lien-waiver-settings.gif|Settings, Jobs & billing: the Physical invoice block with Signs for the company and His title}}

## Get the leader to sign

Step 5 names the leader who signs. It opens on the company's signer. Pick another leader from the list if this job needs one. There are two ways to sign.

- {{button:blue|✍ He is here, he signs now}} opens the signing pad right here. Use this when he is with you. Hand him the phone, or turn your screen to him.
- {{button:outline|Send it to his desk}} sends the waiver to his Dashboard. He signs it when he is next at his own screen. It comes back to the window signed.

Signing on paper instead? Click **Print it**, then **Mark issued**.

While it waits at his desk, step 5 says who it waits for. Click **Cancel request** to take it back.

Step 5 also shows when no title will print. Click **Add his title in Settings** to set it once.

When he signs now, he draws his signature with a finger or the mouse. He cannot type it. The pad locks to drawing whenever the signer is not the person signed in. This holds on every door into it, including {{button:outline|Sign it ›}} on the Bill tab. The record names him as the signer and names your device.

If you are the leader, the button reads {{button:blue|✍ Sign it now}}.

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

Once the waiver is signed, steps 1 to 5 fold to one line each. Step 6 is the one left, with three buttons.

- {{button:blue|Send to the GC}} emails the signed PDF to the GC's billing address. The subject names the bill, so it lands in the same thread. On a job with no GC it goes to the customer.
- {{button:outline|Download PDF}} saves the signed PDF to your computer.
- {{button:outline|Print}} opens the letter for a printer.

If the button is grey, the GC has no billing email on file. Add it on the GC's customer record and come back.

## On GC Review

Open a GC's row in [GC Review](/jobs?tab=stages&gcReview=1). Each bill ends with two chips. They read the same way as on the Bill tab.

- Green means done. {{chip:green|Conditional ✓ sent Sep 30}}
- Amber means a waiver you started needs its next step. {{chip:yellow|Conditional ✓ signed · send it}}
- Grey means no waiver yet, or one that waits on the money. {{chip:gray|Conditional · not added}}

Click a chip to open the job. The Bill tab's door adds or sends the waiver.

{{gif:send-a-gc-our-lien-waiver-gcreview.gif|GC Review: Knight's bills read grey with no waiver started. Loberg's signed one is amber.}}

## What the GC sees

A waiver shows on the GC's account page once the leader has signed it. A waiver still waiting for his signature shows nowhere.

- Each open bill gets one more line in its note, beside the money it covers. It reads like {{chip:yellow|⤓ Lien waiver · conditional, signed Sep 29}}. The link opens the signed PDF.
- The **Your papers** card lower on the page has a **Lien waivers** group. It sits between **Agreements** and **Test reports**. Each signed waiver is one row with a **View waiver** button. A paid bill keeps its waivers there after it leaves the bills.

:::example A waiver in Your papers
{{chip:yellow|SIGNED · Sep 29, 2026}} means the conditional waiver for an open bill.
{{chip:green|PAID IN FULL · Sep 18, 2026}} means the unconditional waiver for a paid bill.
:::

Their bookkeeper can find every waiver there without calling the office. Open a GC's room from the globe on their Pipeline row. More on that room is in [share a customer their portal](/help/share-a-customer-their-portal).

## What the owner sees

The owner of the property may have an account page too. They see our waivers only on the bills the office shared with them. The bill's note carries the same waiver line. **Your papers** has a group named **Lien waivers on your property**. It keeps the unconditional waiver after the builder pays.

## The email has the account page

The waiver email names the bill and carries the signed PDF. When the GC has an account page, the email also ends with the **Your account, any time** card. It is the same card the bill emails carry, with the QR code and the short address. A GC with no account page gets the email without the card.

## Where the waiver lives afterward

- In the **Release of Lien** window, under **Already on this job**.
- In the **Bill Customer** window, in the **Lien releases** strip.
- On the leader's [Dashboard](/dashboard), in **Needs You**, when a conditional waiver's check has cleared and the unconditional one is owed.

Related guides: [give a customer a lien release](/help/give-a-customer-a-lien-release) and [understand how liens work and which lien tool to use](/help/understand-how-liens-work-and-which-lien-tool-to-use).
