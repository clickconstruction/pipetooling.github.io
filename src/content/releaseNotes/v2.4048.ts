import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4048',
  date: '2026-09-28',
  title: 'Bids → Pricing: the margin brush is its own piece',
  kind: 'fix',
  highlights: [
    'The margin brush on the Pricing tab — sweep across rows to price them at one margin — now lives in its own piece of the app, with tests for which rows it prices, what a sweep saves and what Undo puts back. Nothing on screen changed.',
  ],
}

export default note
