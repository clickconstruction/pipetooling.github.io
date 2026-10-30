import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6168',
  date: '2026-10-30',
  title: 'Plan sets on a bid: the ground',
  kind: 'infra',
  highlights: [
    'A bid is getting room for more than one set of plans, each with its own name, memo, date and link. This release lays the table for them; nothing changes on screen yet.',
    'The one plans link a bid has today stays what it is: the set the robot reads and the Plans panel searches.',
  ],
  roles: ['dev'],
}

export default note
