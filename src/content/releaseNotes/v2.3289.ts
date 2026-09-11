import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3289',
  date: '2026-09-11',
  title: 'Bids → Labor: footage rows per 100 ft, tasks and sub lines, and every row says where its hours came from',
  kind: 'feature',
  highlights: [
    'A labor book entry can now read per 100 ft (for pipe rows like "ft of 2IN WASTE") or as a task with fixed hours. Set it on the entry in the Labor book panel; the New view’s queue and Fill from the book carry it onto the row, and the hours come out right on the sheet, the sub-sheet prints and Pricing.',
    'Each queue row in New names what it is — Fixture, Task · fixed hours, or Sub. A sub’s line is answered without hours: it leaves the "rows need hours" count and points you to Direct costs → Subcontractors.',
    'Every saved row now records its source (book, alias, typed, robot) and a note — which entry and book, or what was learned on which bid — so the chips in the grid are facts, not guesses. The head gains an Other direct tile summing equipment, permits, subs, waste and other.',
  ],
}

export default note
