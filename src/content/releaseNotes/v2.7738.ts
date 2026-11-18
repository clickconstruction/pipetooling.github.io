import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7738',
  date: '2026-11-18',
  title: 'Bids: the Pricing bar’s arithmetic has its own tests',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the arithmetic behind the Pricing bar left the big Pricing file for a file of its own: which price counts for a row while you type, while the solver proposes, and once it is saved.',
    'It is tested now, with the revenue and profit checked to the dollar in each of those states.',
    'Nothing changes on screen.',
  ],
}

export default note
