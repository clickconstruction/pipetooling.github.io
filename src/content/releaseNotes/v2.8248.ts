import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8248',
  date: '2026-11-21',
  title: 'Before we start: two presses on a narrow phone no longer sit on each other',
  kind: 'fix',
  highlights: [
    'On a narrow phone, Show it on a line of time and Print the days they gave wrap onto two lines. A tap on the low half of the first one could open the second.',
    'The two lines now sit far enough apart that each takes its own tap.',
    'On a desk, the rows of the line of time have a little air between them, so one stage’s job number no longer sits on the next stage’s name.',
  ],
}

export default note
