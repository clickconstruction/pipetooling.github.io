import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3997',
  date: '2026-09-28',
  title: 'GC Review shows where you are',
  kind: 'feature',
  highlights: [
    'A stage track is pinned to the top of GC Review: Check → Send → Word → Done, each with how many GCs are waiting there and how far along the step is. “You are here” sits on the first stage with work left and moves on by itself.',
    'Press a stage to see only the GCs waiting there, with what they owe together. Press it again, or Show all, for the whole list.',
    'Each GC is one row: its balance, its three steps as one line, and one button for the next step. Click the row to open its bills, its chips and Share — change account man, or mark sent and undo are inside too.',
    'The Temperature board and the scheduled sends are tabs. Total outstanding stays on screen at the bottom, beside Include Collections.',
  ],
}

export default note
