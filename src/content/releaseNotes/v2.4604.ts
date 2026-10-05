import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4604',
  date: '2026-10-05',
  title: 'Database updates no longer hold up every page when a table is added',
  kind: 'infra',
  highlights: [
    'When an update added a table to the database, a safety step locked every table in turn until the update finished.',
    'Pages could stall or fail to load while it ran. The step now touches only the new table.',
    'Nothing changes on your screen.',
  ],
}

export default note
