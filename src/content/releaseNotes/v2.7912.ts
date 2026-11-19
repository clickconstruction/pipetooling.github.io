import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7912',
  date: '2026-11-19',
  title: 'The Bid Board no longer scrolls sideways on a phone',
  kind: 'fix',
  highlights: [
    'On a phone the Bid Board slid sideways whenever Rate a GC after a job was showing. The row of buttons under the search was wider than the screen.',
    'That row now wraps onto a second line, kept to the right. Every button is still there and still the same size.',
    'A desk is unchanged.',
  ],
}

export default note
