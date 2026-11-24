import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8428',
  date: '2026-11-23',
  title: 'Payments: a bill paid from a bank account through Stripe says so',
  kind: 'fix',
  highlights: [
    'A customer who pays a bill through the pay link from a bank account is now recorded as Bank debit · Stripe. Before, every payment through Stripe read Card · Stripe.',
    'It reads that way on Bills sent, on a bill’s record and in the job window. It still counts under the Stripe chip.',
    'A payment already on record keeps the words it has. A card payment is recorded exactly as before.',
  ],
}

export default note
