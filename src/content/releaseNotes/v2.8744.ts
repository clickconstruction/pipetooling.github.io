import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8744',
  date: '2026-11-27',
  title: 'Bids: the Workbench’s numbers have a piece of their own, with tests',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the arithmetic every number on the Pricing Workbench flows from moved out of the big Pricing file into a small piece of its own.',
    'That piece has its own tests now, on a made-up bid whose dollars were pinned on the screen before the move.',
    'Nothing changes on screen.',
  ],
}

export default note
