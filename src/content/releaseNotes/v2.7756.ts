import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7756',
  date: '2026-11-18',
  title: 'Trips: the ground for putting an Extra trip on a bill',
  kind: 'feature',
  highlights: [
    'A trip marked Extra is work past the job’s price. The owner chose how it reaches a bill: the trip becomes one line among a job’s lines, and a bill takes the line later.',
    'This release lays the ground for that. A job’s line can now say which trip it came from, one line a trip, and one checked function writes it. Nothing changes on screen yet.',
    'The press itself, Put on a bill on an open trip, comes in the release that follows.',
  ],
}

export default note
