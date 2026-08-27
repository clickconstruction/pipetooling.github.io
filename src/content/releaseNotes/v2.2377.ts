import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2377',
  date: '2026-08-26',
  title: 'Pay speeds: the drift chart, and a lot less clutter',
  kind: 'feature',
  highlights: [
    'The dot and bucket charts are replaced by one that answers a real question: is each customer paying above or below their own average right now — and the company average — and by how much. Hollow dot = their 12-month average, filled dot = where they are today, dashed line = the company average.',
    '"Where they are today" is honest: red comes from an open bill that has already waited longer than their normal, green only from recent payments actually beating their normal. Customers on their usual pace collapse into a single quiet line.',
    'The breakdown is also one customer list now: thin-history customers (under 3 payments) sit muted at the bottom with a — median instead of a separate section, and the per-row bars, the Data health meter, zero counts, and the footer legend are gone.',
  ],
}

export default note
