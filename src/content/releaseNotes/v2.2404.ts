import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2404',
  date: '2026-08-27',
  title: 'Alternates with their own takeoff',
  kind: 'feature',
  highlights: [
    'The ＋ Add price door has a new choice: "Alternate with its own takeoff" — for in-lieu-of work that changes materials (PEX for copper, cast iron for PVC). It starts as a copy of the bid\'s counts, takeoff and prices, lands on the GC\'s letter as an alternate, and opens ready to swap materials.',
    'Own-takeoff alternates ride the price-options row as cards beside the base — 📐-marked, with their margin calculated from THEIR materials and a "vs base" materials delta, plus a one-tap jump into their takeoff.',
    'Before, every price option shared the base takeoff, so an alternate that changed materials showed a margin costed on the wrong parts.',
  ],
}

export default note
