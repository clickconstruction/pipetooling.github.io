import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8232',
  date: '2026-11-21',
  title: 'Messages on a phone: the page fits the screen',
  kind: 'fix',
  highlights: [
    'On a phone the Messages page was almost three screens wide. The top bar, the row of counts and every card ran off the right edge. The page now fits the screen.',
    'A row under Waiting on them shows the name and our last words first. The chip, Nudge, Heard back and Call sit under them.',
    'A row under Went out shows the name and the words, then when it went. A long line about who mailed whom now breaks onto more lines.',
    'A name that is one long email address breaks inside its card. On a computer the page reads as it did.',
  ],
}

export default note
