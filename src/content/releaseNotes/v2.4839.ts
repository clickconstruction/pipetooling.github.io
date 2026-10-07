import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4839',
  date: '2026-10-07',
  title: 'Bill tab: a bill marked paid with no payment behind it can be removed',
  kind: 'fix',
  highlights: [
    'A bill that reads "marked paid · no payment on record" now has Remove bill in its ⋯ menu. Before, the row had no way off the job.',
    'The window says what happens: no payment changes, the balance owed stays as it is, and the amount goes back to unbilled.',
    'A bill a payment is recorded on, or one Stripe marked paid, is refused with the door to use instead.',
    'Removing it also stops the stamp counting in the customer’s lifetime billed and offering an unconditional lien waiver for money never received.',
  ],
}

export default note
