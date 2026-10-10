---
name: "Copy link on a PDF emailed to sign turns it into a link send"
number: 104
group: close
status: found 2026-10-09 in v2.5101's live walk on J1064 · fix (a) built as v2.5119 (the four window doors and Hand the phone hand out the row's live link, with a 7-day margin) · follow-up 1 built as v2.5145 (send-job-contract's link mode stamps nothing on a row with a live link) · left: deploy send-job-contract, a live check; follow-up 2 only if a trace is wanted
summary: >
  A job's agreement emailed as a PDF to sign by hand keeps its signing link. When the office
  presses Copy link, Text the link or Sign here, now in the Contract window, the app stamps the
  row as a link send. After that, File the signed copy no longer converts the row. Filing the paper adds a new
  signed agreement beside it, and the old one stays out with its reminders running. That breaks
  the case v2.5101 built, where one spouse signs through the link and the other on paper.
next: Deploy send-job-contract after v2.5145 merges, then the live check in v2.5119's fragment on a ZZ TEST job. Retire the card unless a trace is wanted.
size: S
blocker: None.
ver: v2.3631 · 3723 · 5101 · 5119 · 5145
opinion: your call — the guard is built; a trace is the only thing left
mockup: not required — no new screen; Copy link stays where it is
---

# Copy link on a PDF emailed to sign turns it into a link send

## Where it stands

Fix (a) is built as [v2.5119](../docs/recent-features/v2.5119.md). Five doors hand out the link a sent row already carries and call nothing:

- the Contract window's four: Copy link, Text the link, Open the signing page on this device, and Send a link's text-only branch (a draft's, so it still sends);
- the Dashboard's Hand the phone (`openInPersonSigning`).

The link counts only with more than `JOB_CONTRACT_LINK_HANDOUT_MARGIN_DAYS` (7) left. The window reads the row again before handing it out. Left is a live check, then the follow-up.

**Follow-up:**

1. **A guard in `send-job-contract`** — built as [v2.5145](../docs/recent-features/v2.5145.md). Its link mode answers a row already out with a live link with that link and writes nothing: no stamp, no count, no reminder, no `sent` event. The rule is `jobContractLiveToken` in `_shared/jobContractLinkLive.ts`, which the app's doors read too. A draft, a row with no token, or a link near its end still sends. It needs a deploy.
2. **A trace for a hand-out**, if one is wanted. A copied or texted link records nothing today, by design, because its send was recorded when it went out. A trace needs a new `job_contract_events` type, and so a migration. The existing `shared` type cannot carry it: the customer journey (`personJourney.ts`) counts every `shared` event as the signed copy emailed again.

## What happens

An agreement sent with **On paper → Email the PDF** goes out through `share-job-contract`'s `send_to_sign` ([v2.3631](../docs/recent-features/v2.3631.md)). The row reads `sent_channel = 'pdf_email'`. It keeps a signing link as the second way to sign.

In the Contract window (`src/components/jobs/JobContractModal.tsx`), four doors use the link the window last made: `copyLink`, `textLink`, `signInPerson` (**Sign here, now**) and the text-only branch of `sendLink`. When the window has none, each calls `invokeSend('link')`. That is `send-job-contract` in link mode.

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

**(a) Copy the link the row already has.** Staff read the row with `select('*')`, so the window holds `public_token`. When the live row is out and has a token, all four doors build the URL with `jobContractSigningUrl(origin, token)` and call nothing. The signed rail already builds its link that way (`JobContractSignedRail.tsx`). Each link send moves `public_token_expires_at` on, so a token can outlive its link: the row's own link counts only while it has not expired. Every other row goes through `send-job-contract`, as it does today, which mints or renews the link: a draft (even one carrying the token Void & redo moved onto it), a row handed over on paper, or a row whose link has lapsed. Nothing is stamped, so the PDF send keeps its channel, its count and its reminders. Client only, no deploy. Recommended.

**(b) Refuse Copy link on a PDF emailed row.** The window hides the four doors while `sent_channel = 'pdf_email'`. It says the link is in the email, and a link send starts after **Void & redo**. Also client only, but the office loses a useful door: texting the link to a customer who would rather sign on a phone.

Either way, **Send by email** keeps v2.3723's rule. It does send the link, so the row reads as a link send.

## How to verify

- A render test on the window: a `pdf_email` row with a live token. Copy link writes the URL to the clipboard and invokes no function. **File the signed copy** stays. With a lapsed token, Copy link goes through the send, which renews it.
- Live, on a ZZ TEST job: **Email the PDF** to our own address, press **Copy link**, then reload. The strip still reads *📎 PDF emailed to sign by hand*.
