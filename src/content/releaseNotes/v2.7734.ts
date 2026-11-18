import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7734',
  date: '2026-11-18',
  title: 'Bids: Copy prices has a tested rule for which price lands on which row',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the rule Copy prices follows left the big Pricing file for a file of its own: which price lands on which row, and which prices have no row to land on.',
    'It is tested now, with the dollars checked on a whole copy from one GC to another.',
    'Nothing changes on screen.',
  ],
}

export default note
