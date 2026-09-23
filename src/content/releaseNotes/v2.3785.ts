import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3785',
  date: '2026-09-23',
  title: 'The Pipeline strip ticks the days that were worked',
  kind: 'feature',
  highlights: [
    'The two-week strip on every Pipeline row (and phone card) now says what happened on the days that have passed: a green ✓ where someone clocked approved hours, a hollow blue cell where a crew was booked and nobody clocked, grey where nothing was planned.',
    'Hover the strip and it names the people on each worked day; a slipped day reads “booked, nobody clocked”. The Job Calendar shows the same ✓ under its days, so the two agree.',
    'Today’s cell stays plain blue until the day is over — a booked day only reads as missed once it is behind you.',
  ],
}

export default note
