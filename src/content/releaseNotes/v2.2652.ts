import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2652',
  date: '2026-09-02',
  title: 'Materials: Job Accounts — who paid you vs. what you owe your supply houses',
  kind: 'feature',
  highlights: [
    'New Job Accounts tab on Materials (office roles): every job with supply house invoices allocated to it, customer money in vs. supplier money out, side by side.',
    'The headline number is what you\'re holding: unpaid supplier balances on jobs the customer has already paid — those jobs sort to the top, with the owed dollars colored by how far past due they are.',
    'Expand a job for its statement: each house\'s invoices, oldest due date, paid and owed totals, and an Open house button that jumps straight to that house on the Supply Houses tab to make a payment.',
    'Honest math: unpaid invoices not tied to any job or bid show as their own "unallocated" bucket instead of silently vanishing from the totals.',
  ],
}

export default note
