---
title: see the email a customer gets with an estimate
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: estimate email, send to customer, accept link, email preview, subject line, letterhead, reply-to, body template, customer experience, resend link, lost link, copy customer link, customer never got the email, expired, good through, extend the date, expiration date, link expired
order: 64
---
You send an estimate to a customer. They get one email with a private link to the acceptance page.

You press {{button:amber|Send to customer}} on an estimate. ClickTooling first asks **Send to …?** with their email address filled in. So you see exactly who is about to get it. A $0 total is called out in the same ask. You confirm. The customer gets one email with a private link to the acceptance page. Since v2.2747 it is a proper letter, and the link is a button.

## What the customer sees

- **Subject:** *Estimate #482 — Water heater replacement — $4,380 · Click Plumbing*. The number, title and total are in it. So the customer can find it again. Change orders read *Change order #482 — …*. A change order is a priced change to the agreed work.
- **From:** the company name for the logo you picked on the acceptance page. That is *Click Plumbing*, *Click Electrical*, or *Click Plumbing and Electrical*. Replies come to **you**, the person who sent it.
- **The letter:** your logo, the estimate title, a line with the estimate number, the job address and the date. Then your opening paragraph.
- **The total** in a highlighted box. It adds *Pricing is good through …* when the estimate has an **Expires on** date. The estimate may offer options. Then a small table lists every option's price with your recommendation marked.
- {{button:amber|Review & accept the estimate}} is a real button. The plain link sits underneath for anyone whose mail app hides buttons.
- Your sign-off paragraphs. Then a footer with the company address and licence from the acceptance page.

:::example How the pieces line up
{{chip:gray|Logo}} → {{chip:gray|Title + Estimate #482 · address · date}} → {{chip:gray|Opening paragraph}} → {{chip:yellow|Estimate total $4,380}} → {{button:amber|Review & accept the estimate}} → {{chip:gray|Sign-off}} → {{chip:gray|Footer}}
:::

## Preview it before you send

1. Open the estimate.
2. Under **Customer experience**, choose {{button:outline|Email}}.
3. The preview is built by the same code that sends the email. So what you see is what lands. Change the title, the total, the expiry or the logo. The preview follows.

## Resend the link

The customer says the email never came. Or it went to spam. Or you want to text them the link instead. You open the sent estimate and look under **Customer activity**:

1. The line reads *Waiting for customer. The link went to pat@example.com.*
2. Press {{button:blue|Resend link}}. The customer gets the same email again, with a **brand-new link**. The old one stops working the moment you press it.
3. A box appears under the button showing the new link once, with {{button:outline|Copy link}} beside it. Copy it into a text if the customer prefers that. Only this tab shows it. You close the tab and you resend again.

:::example After a resend
{{chip:green|Link resent to pat@example.com.}} Shown here once (this tab only): `https://…/estimate/accept?t=…` {{button:outline|Copy link}}
:::

**Why the old link dies:** the app never stores the link itself, only a fingerprint of it. So a resend has to make a new one. The customer's activity list and the *sent N days ago* chip do not reset. They still count from the first send.

**When you cannot resend:**

- **Pricing has passed its good-through date.** The link would open on "Estimate expired". Extend the date first. See [Extend the good-through date](#extend-the-good-through-date). Resend comes back once the date is good.
- **Accepted, declined or replaced.** There is nothing left for the customer to open.
- **A change order in a bid room.** The GC, the general contractor, signs it on their room page, not from an email.

{{button:outline|Copy customer link}} and {{button:outline|Open customer link}} only work in the tab that sent or resent the estimate. Their tooltip now says exactly that instead of sending you to an admin.

## Extend the good-through date

A customer takes longer than the date you gave them. A city routes a quote through five people over a month. The date passes and their link says *Estimate expired*. You do not start over.

The **Pipeline** tells you first. Once the day is behind you, the Sent row wears the red chip {{chip:red|good through passed · extend?}}. Press it to land on this door with the date field ready.

1. Open the sent estimate. The page reads **Good through** with the date, and **passed** beside it once the day is behind you.
2. Under **Waiting for customer**, find **Good through** with a date field. Press {{button:outline|+2 weeks}}, {{button:outline|+30 days}} or {{button:outline|+60 days}}. Or type a day.
3. Press {{button:blue|Extend good-through to Nov 26, 2026}}. The button names the day.

The link they already have works again. Every copy of it works, so a city's five people keep theirs. **Customer activity** gets the line *Good-through date extended to Nov 26, 2026 by Taunya*. The **sent** chip keeps counting from the first send.

Tick **Email them the letter again, same link, with the new date** before you press. It starts ticked when the date had passed. The customer gets the same letter with the new date and the link they already have. **What went** lists it as *Emailed again, same link*. Press {{button:blue|Resend link}} instead when you want a fresh link and the old one dead.

:::example Who can extend
The same people who can record a decline. A declined, accepted or replaced estimate cannot be extended. Start a new estimate for those.
:::

## Change the wording

The words come from the **Email body template**. A dev sets it under Settings → Estimate customer experience defaults. Or the estimate's own **Customer experience → Email** override sets it:

- The **first paragraph** opens the email, above the total.
- **Every paragraph after it** becomes the sign-off below the button. Blank lines separate paragraphs.
- A paragraph that only holds the link placeholder is dropped. The button takes its place.
- `{{title}}` and `{{estimate_number}}` still work inside the text.

The subject is no longer a template. It is built from the estimate itself. So every customer's email files the same way.
