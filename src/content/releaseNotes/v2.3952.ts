import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3952',
  date: '2026-09-27',
  title: 'Edit Job: the rules for payment lines have tests',
  kind: 'fix',
  highlights: [
    'Which payment lines Edit Job lets you change or remove — and which it refuses because they are matched to a bank deposit, sit on a Stripe bill, or belong to an invoice — is now one tested set of rules.',
    'Nothing on screen changes.',
  ],
}

export default note
