import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3071',
  date: '2026-09-07',
  title: 'Sub portal follows the sheet’s job link',
  kind: 'fix',
  highlights: [
    'A sub’s Plans link, the job number on their Your days list, and the office notifications when they mark work done or report progress all follow the link on the sheet instead of matching job numbers as text.',
    'A sheet on a job that only has a Click number now shows its plans and notifies the job’s watchers like any other.',
  ],
}

export default note
