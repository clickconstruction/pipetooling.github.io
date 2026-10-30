import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6113',
  date: '2026-10-29',
  title: 'Nothing scheduled today stands on its own line',
  kind: 'fix',
  highlights: [
    'On a phone, My Schedule’s empty day wrapped mid-sentence, with “day.” alone on the second line. When the line wraps now, “Nothing scheduled today.” stands alone on the first line and “+ Add job puts a job on your day.” on the second. Every empty list in the app breaks the same way, and one that fits on one line is unchanged.',
  ],
}

export default note
