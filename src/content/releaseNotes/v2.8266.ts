import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8266',
  date: '2026-11-21',
  title: 'In kind: a customer’s profile and Invoices tab say a bill an arrangement pays is scheduled',
  kind: 'fix',
  highlights: [
    'A customer’s profile window no longer shows a job paid in kind as billed 215 days ago in red. The job reads billed, scheduled in kind, with no day count.',
    'The chip under Open balance in that window says the money is scheduled in kind, as the customer’s page already did.',
    'The Invoices tab on a customer’s page reads Billed, in kind for such a bill, with no days after it.',
    'A bill that is not on the arrangement still shows its age, on both screens.',
  ],
}

export default note
