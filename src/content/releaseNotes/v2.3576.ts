import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3576',
  date: '2026-09-17',
  title: 'Edit Job: a customer payment on the wrong job can be moved to the right one',
  kind: 'feature',
  highlights: [
    'On Edit Job → Payments received, every saved payment carries Move to job…: search the job it belongs on, read both jobs\' paid and open before and after, say why, and the payment moves with its date, amount, memo and bank-deposit link — no more remove and retype.',
    'A payment a sent bill already counted stays put and says "unlink it from the bill first" — the customer was told a number. Stripe payments stay with Stripe.',
    'Both jobs keep a grey trace line under Payments received: what left, what arrived, who and why.',
  ],
}

export default note
