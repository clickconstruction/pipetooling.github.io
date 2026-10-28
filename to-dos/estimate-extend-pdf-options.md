---
name: "A sent estimate: extend its date, download it, see every option"
number: 206
group: gated
status: BUILT 2026-10-27 on the nine recommended calls — v2.5988 (every option on the office page), v2.5992 (Extend good-through; migration 20261027220000 pushed, the function redeployed), v2.5997 (the letter again, same link) and v2.5993 (Download PDF) live; the Pipeline's red *good through passed · extend?* chip built 2026-10-28 as v2.6037; live passes green on ZZ rows · left: the owner's look at the nine calls
summary: >
  A sent estimate whose good-through date has passed cannot be extended or re-offered: the
  status line tells the office to start a new estimate, which loses the options and the trail,
  and the link the customer passed around dies. The office page draws only the recommended
  option's lines, so an estimate sent with two options reads as one, and once it has expired the
  office cannot see what the second option said. And there is no PDF of an estimate, though a city
  routes a quote to people who are not the link's addressee. Three asks from the office on
  2026-10-27, one PR each, plus a fourth that tells the customer the date moved with the same link.
next: The owner reads the nine calls against what shipped and changes any; each change is one small PR.
size: M — four PRs: one migration + RPC, two client-only, one edge-function mode
blocker: none — built to the recommendations; a call the owner changes is a small PR each
opinion: build — the office remade a $10,972 estimate by hand today, and a city's approval takes longer than any good-through date the office sets
---

# A sent estimate: extend its date, download it, see every option (#206)

## What shipped (2026-10-27)

Four PRs, each with its release note and `docs/recent-features/` fragment, built on the nine
recommended calls below: **v2.5988** (#6334) *What was offered* on the office page; **v2.5992**
(#6336) **Extend good-through** with the RPC `extend_estimate_good_through` (migration
`20261027220000` pushed) and the trail row; **v2.5993** (#6348) **Download PDF** filed as a
sent copy; **v2.5997** (#6349) the extend panel's tick that mails the stored letter again with the same
link (`send-estimate-to-customer` mode `remail`, deployed) and What went's *Emailed again* rows. Live
passes on ZZ #175 and #176 (both declined after). The owner's calls were built to the recommendations;
a changed call is one small PR each. The follow-up landed on 2026-10-28 as **v2.6037**: the Pipeline's
Sent row wears the red *good through passed · extend?* chip once the day is behind, and its press lands
on the Extend door (`src/lib/estimates/estimateGoodThroughChip.ts`).

## The case

On 2026-10-27 a city called the office: it could not open its estimate any more. Estimate #156
went out by email on Sep 24 with two options and a good-through date. The city's approval runs
weeks and passes the link around: Customer activity shows the link opened from many different
addresses over four weeks, and many *Viewed option — Option 2* lines. When the date passed, the
office page read *Pricing on this estimate has passed its good-through date, so the link would
show "expired". Start a new estimate instead.* The office remade the estimate by hand, from its
notes, and could not read the second option on the office page to copy it.

The office's three asks, in its words:

1. "Need to be able to go back and change the expiration date easier. For now I'll have to
   create a new estimate."
2. "Need an option to also download the PDF to send to more than one person."
3. "When this estimate was sent it had 2 options but I'm unable to see the 2nd option on this
   screen. Plus it's expired so I have no idea what the 2nd option entailed without having the
   notes we created the estimate off of."

## Today, in the code

**Two dates end a link.** `estimates.valid_until` is the good-through day (a calendar date, set on
the draft with the +7 / +14 / +30 / +60 presets, default today + 30, frozen at send). Once that
day passes in the company's calendar, `get-estimate-for-customer` and `accept-estimate` answer
410 *Estimate expired*, and the customer page shows those two words in red under the title. The
link itself has a second life: `public_token_expires_at`, fourteen days from the send or the last
resend (`send-estimate-to-customer`), and a link shared in a message has its own fourteen days in
`estimate_share_links` (`share_estimate_link`, punch list #127). `_shared/estimateTokenLookup.ts`
reads whichever the hash names and answers 410 *Link expired* past it.

**Resend is the wrong door for this.** `canResendEstimateLink` (`_shared/estimateLinkResend.ts`)
refuses a past good-through date (`pricing_expired`), and when it is allowed it re-mints the
token: the old link dies, which is right for a lost link and wrong for a city whose five people
each hold a copy of the same one. Nothing on the sent view edits `valid_until`.

**Option 2 is on the row; the office page never draws it.** `send-estimate-to-customer` freezes
`line_items_snapshot`, `terms_snapshot` and `total_cents` at the send and never writes
`options_snapshot`; nothing clears it on expiry or decline. Before acceptance the frozen lines are
the recommended option's (the owner's decision 3 of v2.2457), and that is what the sent view's
*Line items* table draws (`EstimateLineItemsTable` over `row.line_items_snapshot`). On a sent row
`options_snapshot` is read in two places only: the accepted record (the names of what they passed
on, `describeAcceptedEstimateRecord`) and the **Customer experience → Page** fold at the bottom
of the page, which renders the real picker with every option, on an expired row too. So the
second option was one fold away all along, and nobody knew. (This is a reading of the code, not a
live read of the row: the dev seat's key was refused on 2026-10-27.)

**No PDF.** Neither the office page nor the customer page has a print or download press. The
lines table has print CSS, but the customer page prints its Approve buttons, the picker and the
signature box with it. The app draws PDFs with jsPDF through `src/lib/loadJsPDF.ts` (the physical
invoice, the G702, the GC checks), and a download is a send: `fileSentCopy(..., how: 'download')`
files the copy as *Saved as a file* on the job's Documents (`docs/SENT_COPIES.md`).

## The plan, one PR per ask

### PR 1 — Extend the good-through date (ask 1)

- **Migration** `extend_estimate_good_through(p_estimate_id uuid, p_valid_until date)`, a
  SECURITY DEFINER RPC gated as `record_estimate_decline` is (the same roles, the same
  `user_can_access_estimate` test): only a `sent` row, the new day today or later. It sets
  `valid_until`, pushes `public_token_expires_at` to at least the end of the new day in the
  company's zone, pushes every `estimate_share_links.expires_at` for the estimate the same way,
  and writes one `estimate_customer_events` row in the same transaction: `event_type`
  `good_through_extended`, source `extend_estimate_good_through`, metadata `{from, to, user_id}`.
  The two CHECKs and `log_estimate_customer_event` widen for the new type and source. Idempotent,
  `SET lock_timeout = '3s';`, numbered from `origin/main`'s latest, `docs/migrations/` fragment.
- **Kernel** `src/lib/estimates/estimateGoodThroughExtend.ts` (Deno-free, in `_shared` if the
  edge function needs it): `canExtendEstimateGoodThrough(status, sentAt, validUntil, now)` with
  the verdict's reasons (draft · accepted · declined · superseded · not a date · a day before
  today); `extendedLinkExpiry(validUntilYmd, currentExpiresAt)`; the presets (+2 weeks, +30 days,
  +60 days, a date) and the words: the status line when the date passed (*Pricing passed its
  good-through date on Oct 24. Extend it and the link they have works again.*), the button
  (*Extend good-through to Nov 26*, the verb in `confirmLabel`), the activity line (*Good-through
  date extended to Nov 26 by Taunya*). Tests on each.
- **The door**: `EstimateExtendGoodThroughPanel.tsx` under the *Waiting for customer* block on the
  sent view (beside Resend link, above Record a decline): the current date, a date field with the
  three presets, and the one button. After the press the status line reads the new date and
  Resend's verdict flips back to ok. `estimateCustomerEventLabel` learns the new type, and
  Customer activity draws the office's line. A render smoke on the panel.
- **Words that move**: `estimateLinkResendBlockMessage('pricing_expired')` stops saying *Start a
  new estimate instead* and points at Extend; the resend panel's *Use New estimate at the top*
  line goes with it. The words are shared with `send-estimate-to-customer`'s 400, so the function
  redeploys with the PR (`check:edge-drift`).
- **Guide**: *see the email a customer gets with an estimate* ("When you cannot resend") and
  *send an estimate and turn it into a job* ("The email never came?") say Extend instead of a new
  estimate; a short section *Extend the good-through date* in the first. Release note +
  `docs/recent-features/` fragment; Glossary's good-through entry gains the sentence.

### PR 2 — Every option on the office page, as it was sent (ask 3)

- **Kernel** `src/lib/estimates/estimateOfferedOptionsView.ts`: from `options_snapshot`, one
  block per option in offered order: the heading (*Option 2 · Replace 50-gal · ★ Recommended ·
  $3,400.00*, an add-on with its `+` and *Add-on* / *Starts ticked*), the pitch, the lines and the
  total, and the one note under the recommended one (*the Pipeline's number until they decide*).
  Tests: order, the chips, an all-add-on estimate, a single-option estimate draws nothing new.
- **The screen**: on a sent, declined or superseded row with 2+ options the *Line items* section
  becomes *What was offered*: the blocks, each with its own `EstimateLineItemsTable`. On an
  accepted row the accepted document stays as it is (what they took) and the same blocks sit under
  a fold *Every option as sent*. Client-only; no migration.
- **Guide**: *offer options on an estimate* gains *What the office sees after the send* and names
  the Customer experience → Page fold as the rehearsal. Release note + fragment.

### PR 3 — Download the estimate as a PDF (ask 2)

- **Kernel** `src/lib/estimates/estimatePaper.ts`: the paper's facts from the row and the resolved
  experience, pure: the brand's letterhead words, the title, the For line, the good-through line,
  every option's block (PR 2's view) or the single document, the terms, the footer lines, and the
  file's name (*Estimate 156 – City of Seguin.pdf*, the customer's name made file-safe). Tests.
- **The drawing** `src/lib/estimates/estimatePaperPdf.ts` over `loadJsPDF`, the physical invoice's
  pattern (letter, margins, page breaks between option blocks, a page count in the foot).
- **The door**: **Download PDF** beside Copy customer link / Open customer link on a sent or
  accepted row. The press draws, downloads, and files a sent copy (`kind: 'estimate_pdf'`, `how:
  'download'`, the customer and the job when there is one), so the Documents tab shows the file
  went. A render smoke on the button.
- **Guide**: *send an estimate and turn it into a job* gains *Send it to more than one person*.
  Release note + fragment; `docs/SENT_COPIES.md` gains the row.

### PR 4 — Tell them the date moved, with the same link (ask 1, the customer's side)

- `send-estimate-to-customer` gains mode `remail`: the stored letter again (the
  `customer_experience_sent` snapshot, as a resend mails it) with today's `valid_until` in the
  letterhead and **the same link**: the accept URL recovered from the stored email body
  (`rewriteEstimateAcceptUrl`'s own pattern), never a re-mint. A body with no URL in it (an org
  template that dropped the placeholder) refuses with words, and the office falls back to Resend.
  A `remail` row in `What went` (*Emailed again to … · Oct 27 at 2:20 PM*).
- The extend panel of PR 1 gains the tick *Email them the letter again, same link, with the new
  date* (call 4 says its default); a text stays the thread's own press, as today.
- `docs/EDGE_FUNCTIONS.md` section + TOC line; deploy with the merge. Release note + fragment.

## The owner's calls

Each row has a recommendation; PR 1 and PR 2 build on it unless the owner says otherwise.

1. **Extend keeps the link they have.** Extending pushes the link's own day (and every shared
   link's) so the forwarded copies keep working; it never re-mints. *Recommend yes* — the case is
   five people holding one link.
2. **Who may extend.** The same gate as Record a decline (dev, master, assistant, estimator,
   primary, superintendent, with the estimate's own access test). *Recommend yes.*
3. **How far.** Any day from today on, with +2 weeks / +30 / +60 presets, no ceiling; the date
   stays a date, not a number of days. *Recommend yes.*
4. **Telling the customer.** The extend sheet's tick *Email them the letter again, same link, with
   the new date* starts ticked when the date has already passed and unticked while it is still
   good. *Recommend that split* — an expired customer needs telling; a live one is just getting
   more room.
5. **The PDF is a file, not a print.** jsPDF draws it; the press downloads it and files a sent
   copy. *Recommend the file* — the office asked for a download, and a download is a send.
6. **The PDF carries no link.** It says *To approve, open the link in the email to <the
   addressee>*; the office sends the link beside it when it wants to. *Recommend no link* — a
   token in a file that gets forwarded is a token nobody can retire.
7. **Every option in full on the office page**, on every sent, declined or superseded row, and
   under a fold on an accepted one. *Recommend yes.*
8. **Resend stays a re-mint.** It is the lost-link door; Extend is the other. The expired words
   point at Extend. *Recommend yes.*
9. **The Sent chip keeps counting from the first send** after an extend, as it does after a
   resend. *Recommend yes* — the customer has been waiting since then.

## Where it plugs in

| Piece | File |
|---|---|
| The two dates | `supabase/functions/get-estimate-for-customer/index.ts`, `accept-estimate/index.ts`, `_shared/estimateTokenLookup.ts` |
| Resend's rule and words | `supabase/functions/_shared/estimateLinkResend.ts`, `src/components/estimates/EstimateResendLinkPanel.tsx` |
| The office events precedent | `supabase/migrations/20260905170000_estimate_declines.sql` (`record_estimate_decline`) |
| The sent view | `src/pages/Estimates.tsx`, the `!isDraft` block: the *Line items* section, the link buttons, the resend panel |
| The options | `src/lib/estimates/estimateOptions.ts`, `estimateAcceptSelection.ts`, `src/components/estimates/EstimateOptionsPicker.tsx` |
| The lines table | `src/components/estimates/EstimateCustomerDocument.tsx` (`EstimateLineItemsTable`) |
| The PDF pattern | `src/lib/loadJsPDF.ts`, `src/lib/physicalInvoicePdf.ts`, `src/lib/sent/sentCopies.ts` + `sentCopiesIo.ts` |
| The email again | `supabase/functions/send-estimate-to-customer/index.ts` (the `resend` branch) |
| The guides | `src/content/help/see-the-email-a-customer-gets-with-an-estimate.md`, `send-an-estimate-and-turn-it-into-a-job.md`, `offer-options-on-an-estimate.md` |

## How to verify

On `/dev-login`, a ZZ test customer, never the city's row. Make a draft with two options, set its
good-through date to yesterday, send it to a ZZ address. The sent view then reads expired at once.

- PR 1: the status line names the passed date and offers Extend; +30 days, press; the line reads
  the new date, Customer activity shows the office's line with the name, Open customer link opens
  the page with *Expires on* the new date, and Resend link is offered again. A text's shared link
  from the thread, made before the extend, still opens.
- PR 2: the sent view draws both options with their lines and totals, the recommended one marked;
  Record a decline, then the declined row still draws both.
- PR 3: Download PDF saves *Estimate NNN – ZZ Test.pdf* with both options on it, no token in the
  file; the Documents tab of the ZZ job (when one exists) lists *Saved as a file*.
- PR 4: with the tick on, the extend press lands one email at the ZZ address whose link is the one
  already in the first email; What went shows the second row.

Clean up: decline the ZZ estimate and leave it in the Ledger under *Include superseded &
declined*.

## Left for later

- ~~The Pipeline's Sent chip does not say the good-through date passed~~ — built as v2.6037
  (2026-10-28): the red *good through passed · extend?* chip, its press landing on the Extend door.
- An accepted estimate's PDF as the signed record (the acceptance page's own paper, with the
  signature block) — PR 3 draws the offer; the record is a second shape.
- The customer page's own *Estimate expired* words could say who to call.
