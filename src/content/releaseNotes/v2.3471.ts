import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3471',
  date: '2026-09-15',
  title: 'Housekeeping: database types regenerated after the Submittals migrations',
  kind: 'infra',
  highlights: ['No change on screen. The generated database types now match production after the three Submittals migrations (the fixture schedule, the reason at the pick, the revisions and their rows).'],
}

export default note
