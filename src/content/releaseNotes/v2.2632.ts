import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2632',
  date: '2026-09-01',
  title: 'Supply house quotes: the price memory starts paying off',
  kind: 'feature',
  highlights: [
    'Picking a supply house for a quote link now shows what they\'ve quoted before — "Moore Supply has last-quoted prices for 12 of these 63 items · newest 3 days ago."',
    'The compare view warns when a quote\'s good-until date lands before your needed-by date, so you re-ask before ordering instead of after.',
  ],
}

export default note
