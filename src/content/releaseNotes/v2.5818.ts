import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5818',
  date: '2026-10-24',
  title: 'Quickfill: the Physical inbox is a deck of papers, each decided with one press',
  kind: 'feature',
  highlights: [
    'The Physical inbox station no longer asks what is still in the pile. A paper that takes two minutes is done, not typed. Type the rest once, and each lands on the deck with the day it came and its age.',
    'Every paper leaves on one press: Done, Trash, File it (where), Task (the Task window opens with the words filled in) or Ask (dispatch or estimating). A pressed paper turns into a green line with Undo.',
    'The station’s count is the paper nobody has decided on, oldest first, amber after two days and red after a week. The ✓ Mark records that count, so the history shows the undecided paper at each look, and an empty deck marks as zero.',
    'The round and the Roller mark this station with their Looked button now, like every other station. Waiting for, Someday and Comes back follow in the next releases.',
  ],
}

export default note
