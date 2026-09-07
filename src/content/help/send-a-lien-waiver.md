---
title: send a sub the right lien waiver
category: Office
roles: dev, master_technician, assistant, controller
keywords: lien waiver, conditional, unconditional, progress payment, final payment, subs, pay, Texas 53.284, release, retention
order: 79
---
When you pay a sub, you want their lien rights for that money released. Texas gives you four statutory waiver forms, and the app picks the right one from the payment itself, so nobody has to remember which is which.

## Send one from the pay row

1. Open the job → **Subs** → **Pay**. Every sheet shows what's agreed, paid, and still due.
2. On the sheet you just paid, click {{button:outline|Lien waiver…}}.
3. The dialog names the waiver it picked and says why in one line. Check the two facts it read from the payment — {{chip:green|Settled in the bank}} or {{chip:gray|Not settled yet}}, and whether this is the last payment on the sheet.
4. {{button:blue|Send with the check}} (or {{button:blue|Send now}}) opens the normal **Send for signature** email with the sub's address filled in. Send it and you're done.

The sub signs on their phone. The form arrives with the project, job number, amount, payee, owner, address, and the extent of the release already filled in — they check it, sign, and the signed PDF files to the sheet and to **People → Contracts**.

:::example What the dialog shows
**Send a lien waiver · Texas R & A** — Payment {{chip:blue|$17,752.65 · Sep 4}} · {{chip:gray|Not settled yet}} · {{chip:gray|One of several payments}}
**Conditional waiver on progress payment** · Texas Property Code § 53.284(b)
Goes out with this check. It releases the sub's lien rights for the period only once the check clears, so it is safe to sign before the money arrives.
:::

## Why there are four

Two questions decide the form, and the app answers both from the payment.

- **Has the money landed?** Not yet → **conditional**: the release takes effect only when the check clears, so it's safe to sign in advance. Settled → **unconditional**: the sub states they have been paid, effective on signing.
- **Is this the last payment on the sheet?** No → **progress**: covers this period and keeps retention and pending changes open. Yes → **final**: covers everything through the end of the job.

So the sequence on any sheet is: conditional progress with each check, unconditional progress once it clears, conditional final with the last check, unconditional final once that clears. Most subs only ever see the first one; the unconditional forms are for when a GC or lender wants a period fully closed, or at job closeout.

:::example Never send an unconditional waiver to a sub who hasn't been paid
Texas makes it illegal to require one before payment. The dialog shows an amber warning on both unconditional forms, and the paper prints the same warning in the largest type on the page. If the payment isn't settled yet, send the conditional form and come back after your bank shows it cleared.
:::

## Not the one you wanted?

Click **Not this one? See the other three** in the dialog. Each alternative says when to use it, and {{button:outline|Use this instead}} swaps it in. The most common reason is a GC asking for an unconditional waiver for a period you've already paid.

## Where the signed waiver lives

- On the sheet's row under **Pay**, with the payment it covers.
- In **People → Contracts** on the sub's row, like every other signed document, with **View signed** and the PDF.

The four forms themselves live in the Contract library's **Forms** tab as Texas § 53.284(b) through (e). They are in a packet with no assignees on purpose: they are sent one at a time, per payment, never as part of onboarding.
