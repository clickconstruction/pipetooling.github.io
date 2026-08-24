import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2210',
  date: '2026-08-23',
  title: 'Turnaway from any report',
  kind: 'feature',
  highlights: [
    'When you open New Report on a job that\'s on your schedule today, a yellow "Turnaway — not ready / not home" option appears under the report types — no need to be in Job Mode.',
    'It opens the same Turnaway form as Job Mode: pick the reason, File Turnaway, and the field report is saved and Dispatch is alerted instantly. Jobs not on your schedule today don\'t show it.',
  ],
}

export default note
