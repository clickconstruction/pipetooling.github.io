import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3453',
  date: '2026-09-14',
  title: 'Housekeeping: database types regenerated after the job-account migrations',
  kind: 'fix',
  highlights: [
    'No visible change. The generated database types were refreshed from production after the five job-account migrations, so the code and the schema read from one source.',
  ],
}

export default note
