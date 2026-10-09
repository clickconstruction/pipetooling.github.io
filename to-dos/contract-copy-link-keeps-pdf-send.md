---
name: "Copy link on a PDF emailed to sign turns it into a link send"
number: 104
group: ready
status: found 2026-10-09 in v2.5101's live walk on J1064 · nothing built
summary: >
  A job's agreement emailed as a PDF to sign by hand keeps its signing link. When the office
  presses Copy link or Text the link in the Contract window, the app stamps the row as a link
  send. After that, File the signed copy no longer converts the row. Filing the paper adds a new
  signed agreement beside it, and the old one stays out with its reminders running. That breaks
  the case v2.5101 built, where one spouse signs through the link and the other on paper.
next: Pick fix (a) or (b) below, then one small client PR with a render test.
size: S
blocker: None.
ver: v2.3631 · 3723 · 5101
opinion: build (a) — copying a link the row already has should record nothing
mockup: not required — no new screen; Copy link stays where it is
---

# Copy link on a PDF emailed to sign turns it into a link send

## What happens

An agreement sent with **On paper → Email the PDF** goes out through `share-job-contract`'s `send_to_sign` ([v2.3631](../docs/recent-features/v2.3631.md)). The row reads `sent_channel = 'pdf_email'`. It keeps a signing link as the second way to sign.

In the Contract window, `copyLink` and `textLink` (`src/components/jobs/JobContractModal.tsx`) use the link the window last made. When it has none, they call `invokeSend('link')`. That is `send-job-contract` in link mode.

Every send through `send-job-contract` stamps `sent_channel: 'link'`, adds one to `send_count` and resets `next_reminder_at`. That is the rule from [v2.3723](../docs/recent-features/v2.3723.md): a row first emailed as a PDF and sent again from the window reads as a link send. The rule is right for **Send by email**. It is wrong for Copy link, which sends nothing.

After the stamp, `isAwaitingPaperCopy` (`src/lib/jobs/jobContractHandoff.ts`) is false, so:

- **File the signed copy** is gone from the window's Nudge group.
- **File their signed contract** passes no row to convert. `fileSignedJobContract` inserts a new signed row, and the sent row stays out with its link and reminders.
- [v2.5101](../docs/recent-features/v2.5101.md)'s mixed record cannot form. That record keeps a first signature given through the link when the paper comes back. An office that copies the link to text it to the customer loses the paper conversion for exactly that case.

## How it was found

The reproduction is v2.5101's walk, step 2, on J1064 *ZZ TEST sink*, 2026-10-09:

1. **Email the PDF** to our own address. The pill reads *PDF emailed · 0 of 2 signed*.
2. Press **Copy link**. The strip turns into *🔗 Link copied … nothing emailed yet … 2 sends*, and **File the signed copy** is gone.

No email went out. The walk voided that agreement and passed on a fresh one, with the link read from the row.

Rev 1 of J1064's agreement is voided, with its token cleared and a stale `next_reminder_at`. `remind-job-contracts` reads only `status = 'sent'` rows that are not voided, so it skips that row.

## Two fixes to weigh

**(a) Copy the link the row already has.** Staff read the row with `select('*')`, so the window holds `public_token`. When the live row has a token, `copyLink` and `textLink` build the URL with `jobContractSigningUrl(origin, token)` and call nothing. The signed rail already builds its link that way (`JobContractSignedRail.tsx`). Only a row with no token goes through `send-job-contract`, as it does today: a draft, or a row handed over on paper. Nothing is stamped, so the PDF send keeps its channel, its count and its reminders. Client only, no deploy. Recommended.

**(b) Refuse Copy link on a PDF emailed row.** The window hides Copy link and Text the link while `sent_channel = 'pdf_email'`. It says the link is in the email, and a link send starts after **Void & redo**. Also client only, but the office loses a useful door: texting the link to a customer who would rather sign on a phone.

Either way, **Send by email** keeps v2.3723's rule. It does send the link, so the row reads as a link send.

## How to verify

- A render test on the window: a `pdf_email` row with a token. Copy link writes the URL to the clipboard and invokes no function. **File the signed copy** stays.
- Live, on a ZZ TEST job: **Email the PDF** to our own address, press **Copy link**, then reload. The strip still reads *📎 PDF emailed to sign by hand*.
