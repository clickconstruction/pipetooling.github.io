import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2217',
  date: '2026-08-23',
  title: 'Bid Board: notes per GC',
  kind: 'feature',
  highlights: [
    'On the Bid Board, each GC line now reads sent date · state · name — the dates and pills line up in a column — and the GC\'s name is tappable.',
    'Tapping a GC opens their notes for that bid: what\'s been said to Loberg stays with Loberg, with the whole-bid notes greyed underneath for context. A 💬 count on the line shows who already has notes.',
    'Scoped notes appear in the bid\'s feed with the GC\'s name tagged, and a filter row (Everything · each GC · Whole bid) appears once any exist. Every note still bumps the bid\'s last-contact clock.',
  ],
}

export default note
