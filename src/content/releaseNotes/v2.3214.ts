import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3214',
  date: '2026-09-10',
  title: 'Bid map: the "bids the map can\'t place" sheet shows each bid\'s stage',
  kind: 'feature',
  highlights: [
    'Every row in the sheet now starts with the bid\'s stage in words, Unsent, Pending, Won, Started or Lost, in the same colour as its map pin, so you can skip the lost ones and type the addresses that still matter.',
  ],
}

export default note
