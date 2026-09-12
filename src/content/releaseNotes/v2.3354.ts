import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3354',
  date: '2026-09-11',
  title: 'Bids remember the day they were decided',
  kind: 'infra',
  highlights: [
    'Marking a bid Won or Lost now records the date. Nothing changes on screen yet; the History & forecast lens on Bid Costs will read it to show how long decisions take.',
  ],
}

export default note
