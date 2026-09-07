import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2993',
  date: '2026-09-07',
  title: 'Housekeeping: database types regenerated after the one-company pushes',
  kind: 'fix',
  highlights: [
    "No visible change. The app's generated database type file was rebuilt from the live schema after today's one-company migrations, so the company owner helper, the retired adoption tables and the two roster-derived views are typed from the source of truth.",
  ],
}

export default note
