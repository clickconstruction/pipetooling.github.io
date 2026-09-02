---
title: give a customer a lien release
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: lien release, conditional waiver, unconditional waiver, progress payment, final payment, release of lien, GC, owner, mechanic's lien
---
When a GC or owner asks for a lien release before (or after) cutting a check, you can generate it straight from the job — prefilled, editable, and ready to email or print.

## Open the release

On the **Pipeline** board, every job row in **Ready to Bill**, **Billed Awaiting Payment**, or **Collections** has a blue release-of-lien button in its small icon row (first icon, next to share). Tap it and the **Release of Lien** window opens with everything filled in from the job. On a phone, it's **Release of lien** in the card's ⋯ menu.

## Pick the right form

Three forms, one switcher at the top:

- **Conditional · progress** — payment has been *promised but not received*. The release only takes effect once the check clears. This is the one to send along with an invoice.
- **Unconditional · progress** — a progress payment has been *received and cleared*. Releases lien rights for that portion of the work only.
- **Unconditional · final** — the job is done and *paid in full*. Fully releases all lien rights on the project.

:::example Which bill lines does it cover?
If the job has more than one bill line, green chips at the top let you pick which line(s) the release covers — the amount and the "progress payments through" date follow your selection. Everything stays editable below, so you can always overwrite what the prefill guessed.
:::

## Check the prefill

- **Check from** — the saved property owner for the job, else the GC, else the customer.
- **Amount** — what's still open on the selected bill lines (or, for the unconditional progress form, what's been received).
- **Contractor / releasing party** — your company block from Settings → Physical invoice issuer.
- **Signed by** — the job master's name and title; add the signer title if it's blank.

## It saves itself

There's no Save button and nothing to cancel: from your first edit the release keeps itself as a **draft** on the job ("All changes saved" in the corner), and the ✕ just closes the window. Open the release again later and the draft picks up exactly where you left it.

## Get it signed — in the app

- {{button:outline-blue|✍ Request signature}} sends the release to the **master plumber** to sign right in the app. The window shows {{chip:yellow|✍ Awaiting signature}} until it's signed, and the document locks so nobody edits what he's signing. When he opens the release, a **Sign now** button lets him sign by typing his name (rendered in a signature script) or drawing with a finger — and his signature then prints on every copy: preview, print, and PDF, with a "signed electronically" stamp under it.
- Prefer wet ink? {{button:outline-blue|Print for signature}} opens the clean letter with fill-in lines, exactly as before.

## Issue it

- {{button:outline-blue|Download PDF}} saves a letter-format PDF to attach anywhere.
- {{button:blue|Mark issued}} records the release on the job explicitly — and printing, downloading, or requesting a signature records it too. **You can't produce the paper without the record**, which is what keeps every release findable on the job forever.

## Save the property's legal info once

On **Customers → Edit → Additional addresses**, every address now has a **Property legal info** panel: the county the paperwork files in (the app suggests it from the city — confirm it), the legal description from the county appraisal district (there's a direct **CAD ↗** link), residential/homestead classification, and the **owner of record with their mailing address** — where lien notices legally go, which is often not the job site.

:::example Why bother?
An address showing {{chip:green|✓ lien-ready}} has everything a lien filing needs, entered once and reused by every job at that property. Link a job to its property record from **Edit Job → Property record** or right in the Release of Lien window — the app suggests the match by address — and the owner of record, filing county, and legal description fill into the lien paperwork automatically.
:::

## The signed release comes back to you

The moment the master signs, the release lands in the **Teams Inbox** (on the Dashboard, and under Checklist → Review) in a **Signed — ready to send** lane for whoever requested the signature:

- {{button:blue|Email to customer — PDF attached}} sends the signed document to the job's customer email — you confirm the address first, and the release is marked {{chip:green|sent ✓}} on the job.
- {{button:outline-blue|Download PDF}} grabs the signed PDF to attach in your own email.
- **Mark sent without emailing** covers a printed or hand-delivered copy.

The master sees his own lane the same way — **Awaiting your signature** — and signs right from the row.

## Track what you issued

Once a release is minted, the app keeps it in sight:

- **Documents → Jobs** lists every release under its job, right beside the billed invoices — with its lifecycle chips ({{chip:yellow|awaiting signature}}, {{chip:green|signed ✓}}) and a click to reopen the exact document, signature included. Voided releases stay listed with a {{chip:red|voided}} chip — nothing ever disappears.
- The job's **activity feed** logs every step — issued, signature requested, signed, voided — under a **Release** tag alongside billing events.

- The release button on the job's Pipeline row wears a **blue box** when the job has an issued release.
- The release window itself lists everything **issued on this job** — View the exact document again or Void a mistaken record, from any Pipeline section.
- The **Bill Customer** window shows a **Lien releases** panel for the job: each release with its amount, issue date, and — for conditional releases — whether the check behind it has cleared. From there you can **View**, **Void**, or start a **+ New release**.

:::example The follow-through
A conditional release only takes effect when the check clears — and once it does, the customer is owed the **unconditional** version. When a payment recorded on the job covers a conditional release, an **Issue unconditional** button appears next to it in Bill Customer, prefilled from the original. A {{chip:blue|Needs you}} card on your Dashboard counts any that are waiting, so none get forgotten.
:::
