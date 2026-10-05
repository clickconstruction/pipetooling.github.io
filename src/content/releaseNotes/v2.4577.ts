import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4577',
  date: '2026-10-05',
  title: 'Final demand letter: a cleaner page, and exhibits that agree with it',
  kind: 'feature',
  highlights: [
    'The letter opens with a box holding the balance due and the day to pay by. The statement of account is one table with a row per invoice, the remedies are numbered, and columns replace the dashes.',
    'Exhibits are labelled in order with no gap. Several invoices are A-1, A-2 and so on, listed in the order they were sent, and the delivery record takes the next letter.',
    'Each invoice exhibit now prints the invoice number and the due date the letter states. Before, the letter could cite one number and due date over an exhibit that printed others.',
    'On every invoice PDF, the quantity no longer runs into the unit price, and the page number reads Page 1 of 1 and sits on the page instead of off its bottom edge.',
  ],
}

export default note
