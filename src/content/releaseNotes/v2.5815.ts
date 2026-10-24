import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5815',
  date: '2026-10-24',
  title: 'Quickfill: the Physical inbox gets a place for each paper (the table and the rules)',
  kind: 'feature',
  highlights: [
    'The Physical inbox station is being redrawn as a clarify deck. Each paper that takes more than two minutes will be typed once with the day it came, and will leave the deck on one press: Done, Trash, File it, Task, Ask, Waiting for, Someday or Comes back.',
    'This release lays the groundwork: the table that holds the papers and the rules for the deck’s count, ages and the mark’s note. Nothing changes on screen yet; the deck itself is the next release.',
  ],
}

export default note
