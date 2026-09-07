import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3011',
  date: '2026-09-07',
  title: 'Housekeeping: database types regenerated after the final one-company drop',
  kind: 'fix',
  highlights: [
    "No visible change. The app's generated database type file was rebuilt from the live schema after the retired adoption tables were dropped, so nothing in the code can still refer to them.",
  ],
}

export default note
