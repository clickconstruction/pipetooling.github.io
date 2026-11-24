import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8435',
  date: '2026-11-24',
  title: 'Document builder: a long list of held GCs reads as one line with a count',
  kind: 'fix',
  highlights: [
    'Under the button that sends to everyone ready, a reason that holds more than three now reads as one line, like Held: 40 GCs have no page yet.',
    'Press that line to see their names. It was one line for each GC, which ran longer than the list above it.',
    'A reason that holds three or fewer still names each one on its own line.',
  ],
}

export default note
