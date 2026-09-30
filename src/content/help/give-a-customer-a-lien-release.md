---
title: give a customer a lien release
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: lien release, conditional waiver, unconditional waiver, progress payment, final payment, release of lien, GC, owner, mechanic's lien
---
When a GC or owner asks for a lien release, you can make it straight from the job. It comes prefilled, editable and ready to email or print.

A lien release is a paper that gives up your lien rights for the work it covers. A GC is the general contractor. They may ask for it before or after cutting a check.

## Open the release

Open the **Pipeline** board. Every job row in **Ready to Bill**, **Billed Awaiting Payment**, or **Collections** has a blue release-of-lien button. It sits in the row's small icon row, first, next to share. Tap it. The **Release of Lien** window opens with everything filled in from the job. On a phone, it's **Release of lien** in the card's ⋯ menu.

## Pick the right form

Three forms, one switcher at the top:

- ***Conditional · progress***: payment has been *promised but not received*. The release only takes effect once the check clears. This is the one to send along with an invoice.
- ***Unconditional · progress***: a progress payment has been *received and cleared*. It releases lien rights for that portion of the work only.
- ***Unconditional · final***: the job is done and *paid in full*. It fully releases all lien rights on the project.

:::example Which bill lines does it cover?
If the job has more than one bill line, green chips at the top let you pick which line(s) the release covers — the amount and the "progress payments through" date follow your selection. Everything stays editable below, so you can always overwrite what the prefill guessed.
:::

## Check the prefill

- **Check from**: the saved property owner for the job, else the GC, else the customer.
- **Amount**: what's still open on the selected bill lines. For the unconditional progress form, it is what's been received.
- **Contractor / releasing party**: your company block from Settings → Physical invoice issuer.
- **Signed by**: the job leader's name and title. Add the signer title if it's blank.

## It saves itself

There's no Save button and nothing to cancel. From your first edit the release keeps itself as a **draft** on the job. The corner reads *All changes saved*. The ✕ just closes the window. Open the release again later. The draft picks up exactly where you left it. A date left half typed holds the save until the year is finished. Half typed means a year typed as `26`, say. The corner says *Not saved: a date is not finished* until then.

## Get it signed — in the app

- {{button:outline-blue|✍ Request signature}} sends the release to the **master plumber** to sign right in the app. The window shows {{chip:yellow|✍ Awaiting signature}} until it's signed. The document locks so nobody edits what he's signing. When he opens the release, a **Sign now** button lets him sign. He types his name, which is rendered in a signature script, or draws with a finger. His signature then prints on every copy: preview, print, and PDF. A "signed electronically" stamp sits under it.
- Prefer wet ink? {{button:outline-blue|Print for signature}} opens the clean letter with fill-in lines, exactly as before.

## Issue it

- {{button:outline-blue|Download PDF}} saves a letter-format PDF to attach anywhere.
- {{button:blue|Mark issued}} records the release on the job explicitly. Printing, downloading, or requesting a signature records it too. **You can't produce the paper without the record**. That is what keeps every release findable on the job forever.
- An issued release is locked as it reads. So none of those four buttons works while a date is half typed. A line names the box. It reads like *Finish the “Signature” date before this is issued. Type the year in full, like 2026.* The release stays a draft until you finish the year.

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

- {{button:green|Issue unconditional}} opens the Release of Lien window already on the ***Unconditional · progress*** form. The covered bill lines are selected. The amount is filled from the applied payments. Mint it by print, PDF, or request signature. The row disappears. The card count falls with it.
- The **job name** opens the Job window for context. That is the window with the *Job · Edit · Bill* tabs. The list stays open underneath. Closing the window puts you right back.
- **View release** reopens the original conditional document so you can check the amount and through-date first.

The same list opens from the Needs you section in Quickfill on a phone. Each row is a card with a full-width button.
