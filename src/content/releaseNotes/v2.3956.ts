import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3956',
  date: '2026-09-27',
  title: 'Edit Job: removing a payment is its own piece',
  kind: 'fix',
  highlights: [
    'Removing a payment line, dropping a hand-typed line once its payment is recorded on the bill, and “Unlink and remove” for a bank-matched payment lived inside the job form. They are now one piece of its own, with tests for each path.',
    'Nothing on screen changes.',
  ],
}

export default note
