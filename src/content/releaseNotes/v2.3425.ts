import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3425',
  date: '2026-09-14',
  title: 'Demand letter: the letter now reads the bill',
  kind: 'feature',
  highlights: [
    'The final demand letter’s debt section is now a statement of account read straight from the bill: the invoice number the customer saw, when it was sent and due, each line as billed, payments and credits, and the balance — one block per invoice when the demand covers several.',
    '“Who owes it” comes from the bill itself: a bill addressed to the GC is demanded of the GC, a bill to the customer of the customer. On a GC job the letter points you to the § 53.056 notice for the property owner instead.',
    'The invoice number on the letter is always the one on the bill (for a Stripe-hosted bill, the number Stripe printed), never an internal id fragment.',
    'Something wrong in the statement? Fix it on the bill and the letter follows — the two can no longer disagree.',
  ],
}

export default note
