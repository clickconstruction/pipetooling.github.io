import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3446',
  date: '2026-09-15',
  title: 'Database types regenerated after the owner-of-record migration',
  kind: 'fix',
  highlights: ['No visible change. The app’s generated database types now match the owner-confirmation columns and function exactly, after the migration was applied.'],
}

export default note
