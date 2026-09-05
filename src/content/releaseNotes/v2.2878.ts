import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2878',
  date: '2026-09-05',
  title: 'Stripe receipts point back to the customer’s statement, and the statement refreshes itself after a payment',
  kind: 'feature',
  highlights: [
    'New Stripe bills carry one more footer line — "See your updated statement any time at my.clickplumbing.com/…" — so a customer who just paid on Stripe’s page has a way back to their portal. Your own footer text stays exactly as typed; the line is added after it.',
    'The customer portal looks again when the customer comes back from paying (and when they arrive from the receipt link), so the balance is never stale. When a bill they saw open has been paid, a small "Payment received — statement updated" note confirms it.',
    'Bills addressed to someone other than the customer (Bill-to) never carry the portal link — the payer isn’t the portal holder.',
  ],
}

export default note
