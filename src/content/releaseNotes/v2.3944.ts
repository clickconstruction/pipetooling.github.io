import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3944',
  date: '2026-09-27',
  title: 'People → Review: the loading helpers have tests',
  kind: 'fix',
  highlights: [
    'The four helpers the Review tab uses to read its data — paging past the row cap, failing loudly on a bad read, finding a sheet’s job and a job’s status — moved to their own tested module. Nothing on screen changed.',
  ],
}

export default note
