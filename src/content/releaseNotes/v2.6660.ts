import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6660',
  date: '2026-11-07',
  title: 'The Legal desk asks a sub on the sheets for a signed statement too',
  kind: 'feature',
  roles: ['dev', 'controller'],
  highlights: [
    'On the Legal desk’s Evidence tab, Signed statements under each job now offers Ask… for every sub on the job’s sheets, marked on the sheets, beside the people who clocked there. A sub never punches, so until now the band had no press for them.',
    'The press opens the Hours statement window on the job with the sub picked, and the paper reads their sheets’ lines, one group a sheet, as the window does.',
    'A job with a sheet and no punches is no longer read as a gap job: the sheet is the company’s record of what it bought.',
  ],
}

export default note
