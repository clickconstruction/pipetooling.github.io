import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3483',
  date: '2026-09-15',
  title: 'Housekeeping: database types regenerated after the report-email migrations',
  kind: 'infra',
  highlights: ['No change on screen. The generated database types now match production after the report-email team-leads migration and the GC unpaid-months lookup.'],
}

export default note
