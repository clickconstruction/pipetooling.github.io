import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8754',
  date: '2026-11-27',
  title: 'Bids: the split under a Workbench row has a piece of its own, with tests',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the lines that open under a Pricing row, Material, Sales tax and Labor, moved out of the big Pricing file into a small piece of their own.',
    'Every cell of those lines was pinned by tests on the screen before the move, with the tax press, a typed material price and a typed markup.',
    'Nothing changes on screen.',
  ],
}

export default note
