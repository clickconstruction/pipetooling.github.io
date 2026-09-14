import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3422',
  date: '2026-09-14',
  title: 'Pipeline: database types regenerated after the crew-feed migration',
  kind: 'fix',
  highlights: ['No visible change. The app’s generated database types now match the crew-position function exactly, after the migration was applied.'],
}

export default note
