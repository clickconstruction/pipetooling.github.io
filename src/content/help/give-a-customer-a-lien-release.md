---
title: give a customer a lien release
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: lien release, conditional waiver, unconditional waiver, progress payment, final payment, release of lien, GC, owner, mechanic's lien
---
When a GC or owner asks for a lien release, you can make it straight from the job. It comes prefilled, editable and ready to email or print.

A lien release is a paper that gives up your lien rights for the work it covers. A GC is the general contractor. They may ask for it before or after cutting a check.

## Open the release

Open the **Pipeline** board. Every job row in **Ready to Bill**, **Billed Awaiting Payment**, or **Collections** has a blue release-of-lien button. It sits in the small icons under **Edit**, between share and the orange lien hammer. Tap it. The **Release of Lien** window opens with everything filled in from the job. On a phone, it's **Release of lien** in the card's ⋯ menu.

## Follow the six steps

The left side of the window is six numbered steps. Work them from top to bottom. The right side shows the paper as it will print.

1. **Pick the bills.** Tick the bill lines the release covers. A job with one bill has nothing to pick.
2. **Check the form.** The app picks the form from the bills you ticked.
3. **Check the amount.** It follows the bills and the form.
4. **Check the details.** These are the lines the paper prints, like the project and the dates.
5. **Get it signed.**
6. **Send it.** The step names who gets it, most often the GC.

A step that needs a fix holds the steps under it. Each one reads *Waits for step N* until the fix is made.

## Pick the right form

There are four forms. Two switches in step 2 choose between them. One reads **Conditional** or **Unconditional**. The other reads **Progress** or **Final**.

- ***Conditional · progress***: a progress payment has been *promised but not received*. The release only takes effect once the check clears. This is the one to send along with an invoice.
- ***Unconditional · progress***: a progress payment has been *received and cleared*. It releases lien rights for that portion of the work only.
- ***Conditional · final***: the last payment has been *promised but not received*. It takes effect once that check clears.
- ***Unconditional · final***: the job is done and *paid in full*. It fully releases all lien rights on the project.

Pressing **Unconditional** asks before it switches. An unconditional release holds even when the check behind it does not clear.

:::example Which bill lines does it cover?
If the job has more than one bill line, step 1 lets you pick which line(s) the release covers — the amount and the "progress payments through" date follow your selection. Everything stays editable below, so you can always overwrite what the prefill guessed.
:::

## Check the prefill

- **Check from**: the saved property owner for the job, else the GC, else the customer.
- **Amount**: what's still open on the selected bill lines. For the unconditional progress form, it is what's been received.
- **Contractor / releasing party**: your company block from Settings → Physical invoice issuer.
- **Signed by**: the job leader's name and title. Add the signer title if it's blank.

## It saves itself

There's no Save button and nothing to cancel. From your first edit the release keeps itself as a **draft** on the job. The corner reads *All changes saved*. The ✕ just closes the window. Open the release again later. The draft picks up exactly where you left it. A date left half typed holds the save until the year is finished. Half typed means a year typed as `26`, say. The corner says *Not saved: a date is not finished* until then.

## Get it signed

Step 5 offers three ways.

- {{button:blue|✍ He is here, he signs now}} opens the signature pad on this screen. Hand him the phone or turn the screen. He draws his signature or types his name. When you are the signer, the button reads **✍ Sign it now**.
- **Send it to his desk** asks the leader to sign later. The window says it is waiting for his signature. The release locks so nobody edits what he is signing. **Cancel request** unlocks it.
- Signing on paper instead? Press **Print it**, then **Mark issued**.

His signature then prints on every copy. A "signed electronically" stamp sits under it.

## Send it

Step 6 opens once he signs.

- The blue **Send to** button emails the signed PDF. The button names who gets it, and the line above it shows the address.
- {{button:outline-blue|Download PDF}} saves a letter-format PDF to attach anywhere.
- Printing, marking issued or asking for a signature records the release on the job. **You can't produce the paper without the record**. That is what keeps every release findable on the job forever.
- An issued release is locked as it reads. So none of those buttons works while a date is half typed. A line names the box. It reads like *Finish the “Signature” date before this is issued. Type the year in full, like 2026.* The release stays a draft until you finish the year.

## Save the property's legal info once

Open **Customers → Edit → Additional addresses**. Every address now has a **Property legal info** panel. It holds the county the paperwork files in. The app suggests the county from the city. Confirm it. It holds the legal description, the lot as the county records name it. That comes from the county appraisal district. There's a direct **CAD ↗** link. CAD is the county appraisal district. It holds the residential or homestead classification. It holds the **owner of record with their mailing address**. That is where lien notices legally go, which is often not the job site.

:::example Why bother?
An address showing {{chip:green|✓ lien-ready}} has everything a lien filing needs, entered once and reused by every job at that property. Link a job to its property record from **Edit Job → Property record** or right in the Release of Lien window — the app suggests the match by address — and the owner of record, filing county, and legal description fill into the lien paperwork automatically. When none of the customer's saved properties is the job address (a builder entered as the customer only has its office on file), the row offers {{button:outline-blue|+ Add 628 Terrell Rd as a property on RMC- Dudley Mason}}: the property sheet opens with the job address, the lookup runs, and **Add property** saves it on the customer and links the job in one go.
:::

## The signed release comes back to you

The moment the leader signs, the release lands in the **Teams Inbox**. That is on the Dashboard, and under Checklist → Review. It sits in a ***Signed — ready to send*** lane for whoever requested the signature:

- {{button:blue|Email to customer — PDF attached}} sends the signed document to the job's customer email. You confirm the address first. The release is marked {{chip:green|sent ✓}} on the job.
- {{button:outline-blue|Download PDF}} grabs the signed PDF to attach in your own email.
- **Mark sent without emailing** covers a printed or hand-delivered copy.

The leader sees his own lane the same way. It is called **Awaiting your signature**. He signs right from the row. In **Dispatch Mode → Inbox** both lanes sit at the very top of the page, above My Inbox.

## Track what you issued

Once a release is minted, that is made, the app keeps it in sight:

- **Documents → Jobs** lists every release under its job, right beside the billed invoices. Each shows its lifecycle chips, {{chip:yellow|awaiting signature}} or {{chip:green|signed ✓}}. A click reopens the exact document, signature included. Voided releases stay listed with a {{chip:red|voided}} chip. Nothing ever disappears.
- The job's **activity feed** logs every step under a **Release** tag alongside billing events. The steps are issued, signature requested, signed and voided.

- The release button on the job's Pipeline row wears a **blue box** when the job has an issued release.
- The release window itself lists everything **issued on this job**. View the exact document again, or Void a mistaken record, from any Pipeline section.
- The **Bill Customer** window shows a **Lien releases** panel for the job. It lists each release with its amount and issue date. For conditional releases it also says whether the check behind it has cleared. From there you can **View**, **Void**, or start a **+ New release**.

:::example The follow-through
A conditional release only takes effect when the check clears — and once it does, the customer is owed the **unconditional** version. When a payment recorded on the job covers a conditional release, an **Issue unconditional** button appears next to it in Bill Customer, prefilled from the original. A {{chip:blue|Needs you}} card on your Dashboard counts any that are waiting, so none get forgotten.
:::

## Work the cleared releases from the Dashboard

The **Needs you** card may say a payment cleared behind a conditional release. Then {{button:blue|Issue release}} opens a list rather than the Pipeline board. Every waiting release is a row. It shows the job and the customer. It shows the conditional release with its amount and issue date, and the check that cleared it. The oldest cleared comes first. The total owed sits at the bottom.

A bill paid by check waits seven days before its row appears. The bank can still send a check back in that time. A card, a bank transfer or cash does not wait. A release you are still writing does not clear a row. The row stays until the unconditional is issued.

- {{button:green|Issue unconditional}} opens the Release of Lien window already on the ***Unconditional · progress*** form. A row that reads *Conditional · final* opens on ***Unconditional · final***. The covered bill lines are selected. The amount is filled from the applied payments. Then get it signed in step 5. The row disappears. The card count falls with it.
- The **job name** opens the Job window for context. That is the window with the *Job · Edit · Bill* tabs. The list stays open underneath. Closing the window puts you right back.
- **View release** reopens the original conditional document so you can check the amount and through-date first.

The same list opens from the Needs you section in Quickfill on a phone. Each row is a card with a full-width button.
