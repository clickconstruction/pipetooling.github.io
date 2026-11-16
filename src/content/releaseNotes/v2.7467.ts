import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7467',
  date: '2026-11-16',
  title: 'Supply houses: interest and late fees, kept as their own bill and off the job\'s cost',
  kind: 'feature',
  highlights: [
    'When a supply house adds interest or a late fee, press "+ The house added interest or a late fee" in Record a payment. Type the amount and pick the bill that ran late.',
    'The interest is kept as a bill of its own, marked Interest, named for the late bill and paid by that payment. It is never put on a job.',
    'Interest the house billed that is not paid yet goes in with Add Invoice and the tick "This is interest or a late fee".',
    'Accounts payable adds up the year\'s interest and late fees under its total, with each house\'s share.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
