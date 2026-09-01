import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2597',
  date: '2026-09-01',
  title: 'Bank deposits: dead-end searches point to the recorded payment',
  kind: 'fix',
  highlights: [
    'A job that was already marked paid has no billed-line balance, so it never appeared in the Accounts Receivable "Select billed line" search — with no hint about what to do instead.',
    'Now, when nothing billed matches but a recorded payment does, the empty list offers "Link it instead" — one press switches the allocation to Payment received, picking the matching payment for you when there\'s exactly one.',
  ],
}

export default note
