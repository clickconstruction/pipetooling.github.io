import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3226',
  date: '2026-09-10',
  title: 'Bid basis: opens as you, asks where to save, a lighter file, and the clause on the Approval PDF',
  kind: 'feature',
  highlights: [
    'Get marked-up plans from CountTooling now opens the takeoff as you — no email prompt — and CountTooling logs the visit under your name.',
    'In Chrome and Edge, Download asks where to save and ClickTooling records the exact name you chose; elsewhere the file lands in Downloads as before.',
    'The bid basis export renders lighter than a normal Export PDFs, about a third of the size, so a five-sheet basis stays emailable.',
    'The Approval PDF carries the Bid basis line whenever the letter does.',
  ],
}

export default note
