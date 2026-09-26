import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3846',
  date: '2026-09-26',
  title: 'Get contracts signed floor line reads as one sentence',
  kind: 'feature',
  highlights: [
    'The small line under the Get contracts signed headline used to break in two: "Tap a stage to see its gaps." on one row, "Counting every dollar · set a small‑job floor" on the next. It now flows as one sentence — "…Tap a stage to see its gaps. Counting every dollar, set a small‑job floor" — with a comma before the link instead of a dot separator.',
  ],
}

export default note
