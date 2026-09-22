import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3695',
  date: '2026-09-22',
  title: 'Part of a Stripe bill paid in cash: record it, and the pay link asks for the rest',
  kind: 'feature',
  highlights: [
    'Edit Job → Bill → Record payment on a Stripe bill now takes any amount up to the open balance. Under the balance the window says "Part payment. Stripe lowers the bill to $500.00 due" and the button reads "Record $1,000.00 · $500.00 stays due", so nobody confirms blind.',
    'Stripe puts a credit line on the invoice in the office\'s words — "Cash received Sep 21 · $1,000.00", or "Check #1234 received…" — so the customer\'s pay link and PDF ask only for what is left. They can pay the rest online, or you record it the same way later; either finish moves the job to Paid.',
    'Recorded it wrong? The payment\'s row under ③ Payments received has "Undo part payment": say why, and the credit line is voided and the payment comes off the job.',
    'The whole-balance path is unchanged: at the balance the bill is marked paid at Stripe as before.',
  ],
}

export default note
