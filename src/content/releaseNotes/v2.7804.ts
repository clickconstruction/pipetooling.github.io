import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7804',
  date: '2026-11-18',
  title: 'Trips: see a site’s deleted trips and put one back',
  kind: 'feature',
  highlights: [
    'A site’s Trips look has a new fold under its trips, Deleted trips. Each deleted trip says who deleted it and until when it is kept.',
    'Put back saves the trip again with who went, its days and the number it had. No clock row, bill or cost changes.',
    'A deleted trip is kept for 90 days. The question of Delete this trip now says so, after its minute of Undo.',
    'A site whose only trip was deleted still shows its Trips look, so the trip can be put back.',
  ],
}

export default note
