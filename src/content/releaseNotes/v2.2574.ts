import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2574',
  date: '2026-09-01',
  title: 'Copy fixtures for text — a parts-house list with no prices',
  kind: 'feature',
  highlights: [
    'The Pricing tab’s Share ▾ menu has a new item: Copy fixtures for text.',
    'It copies just the fixture names and counts of the version you’re viewing — no sale prices, totals, or margins — ready to paste into a text to a parts house.',
    'Works as soon as Counts exist, even before a price book or labor is set up.',
  ],
}

export default note
