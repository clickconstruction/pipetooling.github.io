import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3055',
  date: '2026-09-07',
  title: 'Sub sheets are linked to their job, not just its number',
  kind: 'feature',
  highlights: [
    'Every sub labor sheet now carries a real link to its job. Picking a job on a sheet, linking a sheet from Subs → Work, and the sheet a signed work order creates all set it; older sheets were linked from their job number.',
    'Jobs → Team puts a sub sheet on its job row by that link, so a sheet on a job with no clock hours that week still lands on the right row instead of its own.',
    'Linking a sheet to a job that only has a Click number now works — it used to leave the sheet unlinked.',
  ],
}

export default note
