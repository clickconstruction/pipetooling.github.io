import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3546',
  date: '2026-09-16',
  title: 'Bids → Pricing: four rules written down once',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. Which price-book entry prices a fixture, how the bid picker searches, where the Travel ZIP comes from, and how each grid row is assembled are now tested functions of their own — the first step of tidying the Pricing tab the way the Pipeline board was.',
  ],
}

export default note
