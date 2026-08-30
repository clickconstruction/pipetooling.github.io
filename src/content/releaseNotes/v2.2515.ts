import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2515',
  date: '2026-08-30',
  title: 'Robots can price-check the products the plans call for',
  kind: 'feature',
  highlights: [
    'A robot can look up each scheduled product (manufacturer + catalog number) on the web and save what it finds.',
    'Every researched price keeps its source link — one click for an estimator to verify — and is filed under a 🤖 Web Research supplier, never mistaken for a real quote.',
  ],
}

export default note
