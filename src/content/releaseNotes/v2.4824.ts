import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4824',
  date: '2026-10-07',
  title: 'Map: Classify now answers even with a long backlog',
  kind: 'fix',
  highlights: [
    'Classify now on the Map page could report that it failed while it was still placing a long list of new addresses. It now looks addresses up for at most 75 seconds, places what it found, and leaves the rest for the next run.',
  ],
}

export default note
