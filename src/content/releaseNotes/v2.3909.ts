import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3909',
  date: '2026-09-27',
  title: 'Bids → Pricing: dead code swept',
  kind: 'fix',
  highlights: [
    'Two windows on the Pricing tab that nothing could open since the old views left, a switch that was always on, and a handful of settings nothing read came out of the Pricing and Labor tabs. Nothing that runs changed.',
  ],
}

export default note
