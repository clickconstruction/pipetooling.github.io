import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7768',
  date: '2026-11-18',
  title: 'Trips: a trip’s line opens its trip, and a trip says what happens to its line',
  kind: 'feature',
  highlights: [
    'A line that came from a trip now shows Open Trip 14 under it in the job’s Line Items. The press closes the job’s window and opens that trip on its site’s page.',
    'Deleting a trip that is on a job’s lines now says the line stays, with its words and its price. Undo puts the trip back, but the line is no longer tied to it.',
    'Changing a trip’s billing away from Extra after its line was made is allowed. The sheet now says the line stays where it is.',
  ],
}

export default note
