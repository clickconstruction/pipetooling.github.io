import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2995',
  date: '2026-09-07',
  title: 'Housekeeping: the adoption views stop shadowing the roster',
  kind: 'infra',
  highlights: [
    'No visible change. The two roster-derived views from part 5 no longer look like the users table to the API layer, which keeps the generated database types (and the build) the size they were.',
  ],
}

export default note
