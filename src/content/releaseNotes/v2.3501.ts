import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3501',
  date: '2026-09-16',
  title: 'Supply houses: a credit memo cannot go where it would count twice',
  kind: 'fix',
  highlights: [
    'A credit memo can no longer be added to a project step as a line item, or linked to a card charge. Both said yes before and would have taken the same money off a job twice.',
    'Each one now says what the paper is and why it was refused, rather than quietly doing the wrong thing.',
  ],
}

export default note
