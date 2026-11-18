import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7862',
  date: '2026-11-18',
  title: 'Discounts: a job billed from the GC desk takes none',
  kind: 'fix',
  highlights: [
    'On a project we build as the GC, the customer’s price is the contract. It changes only by a signed change order.',
    'Add discount in Bill Customer would have rewritten such a job’s total from its lines and moved it off the contract figure. It is now refused there.',
    'The window says so where the press would be, and names where the discount goes: a change order on the GC desk.',
  ],
}

export default note
