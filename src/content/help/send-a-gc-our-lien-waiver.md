---
title: send a GC our lien waiver
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: lien waiver, GC, general contractor, conditional, unconditional, progress, final, release of lien, he signs now, sign now, send to the GC, waiver PDF, 53.284, bill, pay app
---
A GC often wants a lien waiver with each bill. The waiver says we give up our lien right for that payment. Texas has four forms. The app picks the right one from the bill, and the leader signs it in the app.

## Open the waiver from the bill

1. Go to **Jobs** and open **Pipeline**.
2. Find the job's row under **Billed Awaiting Payment**.
3. Click the blue release of lien button in the row's small icon row. The **Release of Lien** window opens.
4. Check the green bill chips at the top. Pick the bill this waiver covers.

## Check the form the bill picked

Two switches at the top pick the form. The app sets both from the bill.

- **Conditional** or **Unconditional**. Conditional means the check has not cleared yet. It takes effect when the money lands. Unconditional means the money has settled.
- **Progress** or **Final**. Progress means more bills will follow. Final means this is the last bill on the job.

The line under the switches says why. It also shows the two facts it read from the bill. Change a switch if the bill has it wrong.

:::example The four forms
{{chip:yellow|Conditional · progress}} goes out with a bill that is not the last one.
{{chip:yellow|Conditional · final}} goes out with the last bill, before its check clears.
{{chip:green|Unconditional · progress}} goes out once a progress payment has settled.
{{chip:green|Unconditional · final}} goes out once the last payment has settled. It closes the job.
:::

Never send an unconditional form before the money has settled. Texas forbids requiring one before payment. The line under the switches reminds you.

## Get the leader to sign

The **Signed by the leader** box names the leader on the job. There are two ways to sign.

- {{button:outline|Later, from his desk}} sends the waiver to his Dashboard. He signs it when he is next at his own screen.
- {{button:outline|✍ He signs now}} opens the signing pad right here. Use this when he is with you. Hand him the phone, or turn your screen to him.

When he signs now, he draws his signature with a finger or the mouse. He cannot type it. The record names him as the signer and names your device. The signature prints on every copy.

If you are the leader, the button reads {{button:outline|✍ Sign now}}.

## Send it or download it

Once the waiver is signed, three buttons are ready.

- {{button:blue|Send to the GC}} emails the signed PDF to the GC's billing address. The subject names the bill, so it lands in the same thread. On a job with no GC it goes to the customer.
- {{button:outline|Download PDF}} saves the signed PDF to your computer.
- {{button:outline|Print}} opens the letter for a printer.

If the button is grey, the GC has no billing email on file. Add it on the GC's customer record and come back.

## Where the waiver lives afterward

- In the **Release of Lien** window, under **Issued on this job**.
- In the **Bill Customer** window, in the **Lien releases** strip.
- On the leader's Dashboard, in **Needs You**, when a conditional waiver's check has cleared and the unconditional one is owed.
