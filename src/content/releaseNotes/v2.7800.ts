import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7800',
  date: '2026-11-18',
  title: 'Trips: a deleted trip is kept, the ground',
  kind: 'feature',
  highlights: [
    'A deleted trip used to be gone for good one minute after the press, once its Undo left the screen. It is now kept for 90 days, with who went, their days and the jobs it named.',
    'This release lays the ground for that. Nothing changes on screen yet.',
    'The release that follows adds a Deleted fold to a site’s Trips look, where the office sees each deleted trip, who deleted it and when, and puts one back.',
  ],
}

export default note
