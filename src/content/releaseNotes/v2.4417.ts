import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4417',
  date: '2026-10-02',
  title: 'Pricing: a slim Add price button, so the one-price line is shorter',
  kind: 'fix',
  highlights: [
    'On Bids → Pricing, a bid with one GC and one price shows Add price as a small pill at the end of its line.',
    'The line is now as short as its text, about a third shorter than before.',
    'The button does the same thing. With several prices it keeps its full size beside the price cards.',
  ],
}

export default note
