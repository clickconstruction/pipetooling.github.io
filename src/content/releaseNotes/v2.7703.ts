import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7703',
  date: '2026-11-17',
  title: 'Trips: the ground for a number on each trip',
  kind: 'infra',
  highlights: [
    'The groundwork for a short number on each trip, such as Trip 5. No screen changes yet.',
    'The app hands the number out when a trip is made. Nobody types it and it never changes.',
    'A number is never given to a second trip, so a bill that names Trip 5 always means the same trip.',
  ],
}

export default note
