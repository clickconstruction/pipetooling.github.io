import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4714',
  date: '2026-10-06',
  title: 'AIA G702-G703: a change after the workbook went out is named',
  kind: 'feature',
  highlights: [
    'Generate now keeps the application’s figures with the workbook it downloads: each line’s amounts and the G702 totals.',
    'When a saved application is changed after its workbook went out, its line in the history says what moved and by how much, against what the GC was given.',
    'The same warning shows on the job’s Documents tab. Generate again to send the change, or open the application and put the amounts back.',
  ],
}

export default note
