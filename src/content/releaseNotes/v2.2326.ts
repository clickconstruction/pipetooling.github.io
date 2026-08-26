import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2326',
  date: '2026-08-26',
  title: 'Quickfill gets a Missing bill dates station',
  kind: 'feature',
  highlights: [
    'A new Quickfill section lists every billed or paid bill that has no bill date — with the clues to figure the date out: HCP number, address, amount, and when its money landed.',
    'Type the date right on the row (MM/DD/YY) and it clears on the spot; Open job lands on the Bill tab for the ones that need digging.',
    'Only bills that still matter show up — anything older than the No Count Date stays out of the list.',
  ],
}

export default note
