import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3279',
  date: '2026-09-11',
  title: 'Discount row: a dollar amount above the work no longer skews Job Total',
  kind: 'fix',
  highlights: [
    'Typing more dollars off than the work is worth still shows "Can\'t exceed … Kept at …", and now the Job Total and the pipeline card read the kept amount too — before, the footer could show a negative total until the job was reopened.',
  ],
}

export default note
