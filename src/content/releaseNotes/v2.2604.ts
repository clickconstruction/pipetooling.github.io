import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2604',
  date: '2026-09-01',
  title: 'Who owes what: resend a Stripe bill without leaving the view',
  kind: 'feature',
  highlights: [
    'Bill cards for Stripe-billed invoices now show a "Never got it? Resend" button — the same confirm-then-send control the Payment Chase call flow uses, so a customer who lost the email gets it again in two clicks.',
    'Each Stripe card also shows its evidence line — when the invoice email went out — so you know before calling whether one was ever sent.',
    'A resend logs the same payment-chase touch a chase call would, keeping the call sheet\'s "last touch" honest.',
  ],
}

export default note
