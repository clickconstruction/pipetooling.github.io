import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7755',
  date: '2026-11-18',
  title: 'Bids: five small parts of the Pricing bar are their own pieces',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, five small parts of the Pricing bar moved out of the big Pricing file: the Markup and Tax buttons, the lock chip on a sent bid, the line that says what was sent, and the button that prices the robot’s rows.',
    'Each has its own tests now.',
    'Nothing changes on screen.',
  ],
}

export default note
