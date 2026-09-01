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
- {{button:blue|Download PDF}} saves a letter-format PDF to attach anywhere.

The document is designed to be signed by hand: if you leave the signer fields blank, the printed copy carries fill-in lines.
