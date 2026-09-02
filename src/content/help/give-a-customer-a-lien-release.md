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

## Send it

- {{button:outline-blue|Copy for email}} puts the formatted release on your clipboard — paste it straight into an email to the GC.
- {{button:outline-blue|Print}} opens a clean letter for wet signing.
- {{button:outline-blue|Download PDF}} saves a letter-format PDF to attach anywhere.
- {{button:blue|Save & mark issued}} records the release on the job — do this whenever you actually send one.

The document is designed to be signed by hand: if you leave the signer fields blank, the printed copy carries fill-in lines.

## Save the property's legal info once

On **Customers → Edit → Additional addresses**, every address now has a **Property legal info** panel: the county the paperwork files in (the app suggests it from the city — confirm it), the legal description from the county appraisal district (there's a direct **CAD ↗** link), residential/homestead classification, and the **owner of record with their mailing address** — where lien notices legally go, which is often not the job site.

:::example Why bother?
An address showing {{chip:green|✓ lien-ready}} has everything a lien filing needs, entered once and reused by every job at that property. Link a job to its property record from **Edit Job → Property record** or right in the Release of Lien window — the app suggests the match by address — and the owner of record, filing county, and legal description fill into the lien paperwork automatically.
:::

## Track what you issued

Once a release is saved, the app keeps it in sight:

- The release button on the job's Pipeline row wears a **blue box** when the job has an issued release.
- The release window itself lists everything **issued on this job** — View the exact document again or Void a mistaken record, from any Pipeline section.
- The **Bill Customer** window shows a **Lien releases** panel for the job: each release with its amount, issue date, and — for conditional releases — whether the check behind it has cleared. From there you can **View**, **Void**, or start a **+ New release**.

:::example The follow-through
A conditional release only takes effect when the check clears — and once it does, the customer is owed the **unconditional** version. When a payment recorded on the job covers a conditional release, an **Issue unconditional** button appears next to it in Bill Customer, prefilled from the original. A {{chip:blue|Needs you}} card on your Dashboard counts any that are waiting, so none get forgotten.
:::
