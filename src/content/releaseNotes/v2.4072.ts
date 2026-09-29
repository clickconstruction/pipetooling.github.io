import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4072',
  date: '2026-09-28',
  title: 'Bids page smoke: what Edit Bid writes is pinned',
  kind: 'fix',
  highlights: [
    'A new test records exactly what the Bids page saves when you edit a bid, close it, or create one — so the upcoming clean-up of that code can prove it changes nothing. Nothing you see changed.',
  ],
}

export default note
