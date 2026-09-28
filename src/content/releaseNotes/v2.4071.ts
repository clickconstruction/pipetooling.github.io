import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4071',
  date: '2026-09-28',
  title: 'Bids → Pricing: the price cards are their own piece',
  kind: 'fix',
  highlights: [
    'The row of price cards on the Pricing tab — each price, the alternates with their own takeoff, and the "Add a price or GC" door — now lives in its own piece of the app, with tests for which cards show and what each button does. Nothing on screen changed.',
  ],
}

export default note
