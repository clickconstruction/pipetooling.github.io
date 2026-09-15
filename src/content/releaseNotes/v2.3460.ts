import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3460',
  date: '2026-09-15',
  title: 'Pricing: plug in the fixture schedule, and the quote compare says which picks are as specified',
  kind: 'feature',
  highlights: [
    'Bids → Pricing → Supply house prices (RFQ) ▾ → Plug in the fixture schedule: paste the plan’s schedule and each tag becomes the specified make and model on the bid, matched to your count rows.',
    'The Supply house quotes compare gains a Specified column and a status on every row: as specified, superseded, equal, alternate, design change, or missing — so the alternates are visible the day a house is picked, not when the GC asks.',
    'A line above the grid counts them: "6 as specified · 8 alternates · 1 design change · 1 missing".',
  ],
}

export default note
