import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3415',
  date: '2026-09-14',
  title: 'Lien desk: database types regenerated after the two migrations',
  kind: 'fix',
  highlights: ['No visible change. The app’s generated database types now match the Lien desk tables and functions exactly, after both migrations were applied.'],
}

export default note
