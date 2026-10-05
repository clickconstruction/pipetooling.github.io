---
title: send a sub the right lien waiver
category: Office
roles: dev, master_technician, assistant, controller
keywords: lien waiver, conditional, unconditional, progress payment, final payment, subs, pay, Texas 53.284, release, retention
order: 79
---
When you pay a sub, you want their lien rights for that money released. Texas has four waiver forms. The app picks the right one from the payment, so nobody has to remember which is which.

## Send one from the pay row

1. Open the job, then **Subs**, then **Pay**. Every sheet shows what is agreed, paid and still due.
2. On the sheet you just paid, press {{button:outline|Lien waiver…}}.
3. The window names the waiver it picked and says why in one line.
4. Check the two facts it read from the payment. One chip reads {{chip:green|Settled in the bank}} or {{chip:gray|Not settled yet}}. The other says whether this is the last payment on the sheet.
5. Check the address under **Sub's email for the signing link**. Type it if the box is empty.
6. Press {{button:blue|Send with the check}}. On a settled payment the button reads {{button:blue|Send now}}.

The window sends the signing link itself. There is no second email to write.

The sub signs on their phone. The form arrives filled in. It has the project, the job number, the amount, the payee, the owner and the address. They check it and sign. The signed PDF files to the sheet and to **People → Contracts**.

:::example What the window shows
The title reads **Send a lien waiver · Texas R & A**. The chips read {{chip:blue|Payment $17,752.65}}, {{chip:gray|Not settled yet}} and {{chip:gray|One of several payments}}. The form is **Conditional waiver on progress payment**. It goes out with this check. It releases the sub's lien rights for the period once the check clears. So it is safe to sign before the money arrives.
:::

## If the app read the payment wrong

The app guesses that a payment has settled once it is seven days old. It cannot see the sub's bank. Two tick boxes let you correct it.

- **The money has landed in the sub's account** switches between conditional and unconditional.
- **This is the final payment on the sheet** switches between progress and final.

## Why there are four

Two questions decide the form. The app answers both from the payment.

- **Has the money landed?** If not, the form is **conditional**. The release takes effect only when the check clears, so it is safe to sign early. If it has, the form is **unconditional**. The sub states they have been paid, and it takes effect on signing.
- **Is this the last payment on the sheet?** If not, the form is **progress**. It covers this period and keeps retention and pending changes open. If it is, the form is **final**. It covers everything through the end of the job.

So a sheet runs in this order. A conditional progress waiver goes with each check. An unconditional progress waiver follows once the check clears. A conditional final waiver goes with the last check. An unconditional final waiver follows once that clears.

Most subs only ever see the first one. The unconditional forms are for a GC or lender who wants a period fully closed. They are also for job closeout.

:::example Never send an unconditional waiver to a sub who has not been paid
Texas makes it illegal to require one before payment. The window shows an amber warning on both unconditional forms. The paper prints the same warning in the largest type on the page. If the payment has not settled, send the conditional form. Come back after your bank shows it cleared.
:::

## Not the one you wanted?

Press **Not this one? See the other three** in the window. Each of the other forms says when to use it. {{button:outline|Use this instead}} swaps it in. The most common reason is a GC asking for an unconditional waiver for a period you already paid.

## Where the signed waiver lives

- On the sheet's row under **Pay**, with the payment it covers.
- In **People → Contracts** on the sub's row, like every other signed document. It has **View signed** and the PDF.

The four forms live in the Contract library's **Forms** tab. They are the four Texas § 53.284 forms. They sit in a packet with no assignees on purpose. They are sent one at a time, per payment, never as part of onboarding.
