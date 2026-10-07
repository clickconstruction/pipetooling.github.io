---
title: use the cover letter studio
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: cover letter, studio, layout, preview, proposal, letter, send, google docs, versions, base, alternate, letter total, alternates, same page, separate pages, reduced, wording, rename, per GC, options, option 1, two versions, pick one
order: 93
---
The **Bids → Cover Letter** tab is a two-pane studio, with your controls in numbered steps on the left. The letter itself stays on screen at the right the whole time, repainting live as you type.

## One letter per GC

The studio writes **one letter per GC**. A GC is the general contractor you bid to. The letter holds each of that GC's packets at its ★ base price. The letter also adds any price you offered that GC as an alternate. The earlier scenario-bundling letter and its Old / New pills retired in September 2026.

## The two steps

- {{chip:blue|1 Scope & pricing}}: who the letter is to, what's in the letter, and the headline amount. **Mark sent** stamps that amount as the bid's value, along with the sent date. There's nothing to apply by hand. Even a bid with no send-packets gets its own {{button:blue|Mark sent today}} here.
  - **A $0 bid never reaches the letter**. A checked bid with no prices yet is listed grayed, as *unpriced — left off the letter*. That bid rejoins the letter and Mark sent the moment it's priced.
  - When the bid goes to more than one GC, tabs above the form pick whose letter you're writing. Under **In {{chip:gray|GC}}'s letter**, you check the packets that go in. A packet is a priced bid you send a GC, with its own counts and prices. Each packet is **Base** or **Alternate**. A base packet adds to the letter total. An alternate is offered in lieu of the base, meaning instead of it. The prices you ticked under a packet are offered to that GC as alternates. The headline is the **letter total**. The letter total is the sum of the base packets at their ★ prices. You change a price on the Pricing tab, and the letter follows.
  - **Sending:** {{button:blue|Mark sent to Burd & Assoc.}} stamps that GC's packets with today's date and their ★ value. The button also sets the bid's sent date and value. The packet then shows *sent 7/7 · $279,579* here and on the Send to strip. Followup's **Full bid details** lists ***Sent to — by GC*** with each GC's answer.

:::example One GC, one price?
Step 1 shows a single line — *One bid — the letter shows ★ WENDI* — and the letter is exactly what it was. To offer that GC a second price, add it on the Pricing tab with {{button:outline|＋ Add price}} and offer it from the card's bottom bar.
:::
- {{chip:blue|2 Letter content}}: what's included, the schedule and payment editors, and the inclusions / exclusions / terms text. What's included is set with on/off pills. The pills are Plan date, Fixtures per plan, Signature, Schedule of values, Payment schedule and Materials by stage. A schedule of values breaks the price into lines for billing. The schedule and payment editors sit under the pills.

## Alternates on one page

A letter that has alternates puts them **on the same page** as the base bid. There is one address block, one proposal amount, and an **Alternates:** list right under it. Alternates are numbered. Each alternate leads with **Add / Deduct**, the way builders read them. The resulting total follows in parentheses. A price you offered on an alternate nests under it as an ***"— or"*** line. That line does not repeat the scope.

:::example What the GC reads
Alternates:
• **Alternate 1 — PEX in lieu of copper**: **no change** ($56,343.00)
&nbsp;&nbsp;&nbsp;&nbsp;— or **Standard-grade fixtures**: **Deduct $14,643** ($41,700.00)
:::

- **Rename things right in step 1**. Every bid name and price name in the checklist has a ✎. The letter prints exactly these names. Your team sees the same names everywhere too. An offered price you **never renamed** prints as a bare *"— or: Deduct $…"* line. Internal names like *Default* never reach the customer.
- **The automatic name is customer-facing**. A packet named after its GC prints under the **project's** name instead. The letter reads *ALSATIAN value engineered*, not *MERIT GENERAL CONTRACTORS value engineered*.
- **Fine-tune wording** by clicking the dashed text right on the preview. The dashed text is the alternate's name, its optional note line, or the *Alternates:* heading. You type and press Enter, and you're done. {{button:outline|Reset to auto}} brings the automatic text back.
- **The difference is computed**, so it can never disagree with the Pricing tab. The line reads like *Deduct $5,287* or *Add $4,100* against the proposed amount, or *no change* when they match.
- **No base bid, only alternates?** The ★ price leads the letter and the rest are listed against it. The headline amount is never $0.00.
- **Want the old document?** You flip **Alternates in the letter** to {{chip:gray|Separate pages}} in step 1. The switch then gives one full letter per alternate, exactly as before. Your choice is remembered on this device.

## Two versions as options

Say a bid has two versions, To Plans and Value Engineered. Tick both into the letter and leave both on **Base**. The letter now reads as two options. It never adds the two up.

- The letter says *we propose to do the plumbing in one of the following amounts*. Then each option prints its own amount in words and figures.
- An alternate price under an option is a deduct or an add against that option. Alternates number across the whole letter. So a GC can say *Option 2 with Alternate 2*.
- Each option lists its own fixtures when the lists differ. When they match, the list prints once. Exclusions and terms print once for both.
- The first version in the list is **Option 1**. It leads the letter. Use the ▲▼ arrows to pick which version leads.
- {{button:blue|Mark sent today}} stamps Option 1's amount as the bid value. Every version still gets its own sent value. The Bid Board shows Option 1's amount.
- Click any option line or alternate line in the preview to reword it. The dashed text is yours to edit.

:::example Two options on one bid
Option 1, To Plans: $922,196.69, with Alternate 1 excluding med gas at Deduct $41,969.58. Option 2, Value Engineered: $366,998.23, with Alternate 2 excluding med gas at Deduct $37,556.68.
:::

A version you flag **Alternate** still prints as an in-lieu-of line under Option 1. The bid room signs Option 1 and offers the other options in place of it.

## Sending it

The buttons live right under the letter. {{button:blue|Copy & open in Google Docs}} copies the finished document and opens your proposal template. **Print** prints it. The paste-the-link field attaches the shared Proposal back onto the bid. Both buttons wait a moment after you open the tab. The buttons stay greyed while Pricing is still loading, so you can't print or copy a "$0.00" letter. A packet with no GC yet is addressed to **General contractor** everywhere until you link one. Everywhere means the letterhead, the Bid Room panel and the GC's page.

:::example Bidding to two GCs?
When a bid goes to more than one GC, the GC tabs above the form switch whose letter you're writing — each GC only ever sees their own packets and prices. A GC whose packet has no prices yet gets a *No prices yet* note instead of a letter, and its **Mark sent** stays off until it's priced.
:::
