import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4013',
  date: '2026-09-28',
  title: 'Bids → Labor: the direct-cost handlers are one tested piece',
  kind: 'fix',
  highlights: [
    'Adding, editing and removing a direct cost on the Labor tab — equipment, permits, subs, waste, other — now runs through one tested piece instead of five copies, and the Labor total has tests. Nothing on screen changed.',
  ],
}

export default note
