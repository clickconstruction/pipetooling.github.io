import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5787',
  date: '2026-10-23',
  title: 'Quickfill: the Roller, one group at a time on a desk, with the Board as its index',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'The switch beside the Quickfill title gains Roller. It shows one group at a time: the name and count, the question, the group at full width, and ← Previous, Skip, Looked · N open · next → and Next → at the foot. The arrow keys work too.',
    'A strip of dots under the name shows every group in the round in the freshness colours and reads like 7 of 23 · 12 left with work. A dot jumps to its group. The round is every group not yet marked today, due first, the doors last; Show the N marked today puts the rest back.',
    'Groups ▾ opens the Board: every group as a card with its count, its question and when it was last looked at. Tap a card to go there.',
    'Looked marks the group for everyone, with the count it saw, and moves on. The phone round is unchanged.',
  ],
}

export default note
