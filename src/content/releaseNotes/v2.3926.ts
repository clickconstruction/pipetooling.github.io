import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3926',
  date: '2026-09-27',
  title: 'Edit Job: creating an invoice follows one tested order',
  kind: 'fix',
  highlights: [
    'Edit Job creates an invoice from three places: a picked stage, a typed amount, and a hazmat fee billed separately. Each wrote the invoice in its own copy of the same steps; all three now run one tested sequence.',
    'The order is the same as before: the invoice is written, then attached to what it bills, then the remainder on a Ready to Bill job is re-synced.',
    'Nothing on screen changes.',
  ],
}

export default note
