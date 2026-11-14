import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7161',
  date: '2026-11-13',
  title: 'Materials on site: Count this box no longer steps over a line',
  kind: 'fix',
  highlights: [
    'On the phone, Count this box walks a box one line at a time. When you said a part was gone from the box, or saved a count of none, the walk skipped the next line.',
    'The skipped line was never shown and never counted. It kept its old number, and the box still read as counted.',
    'The walk now keeps its own list from the moment it starts, so every line with parts comes up once.',
    'The guide names the walk’s presses as the screen does: 25 is right, Skip this line, Not in A1 any more.',
  ],
}

export default note
