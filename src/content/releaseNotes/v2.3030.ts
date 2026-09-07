import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3030',
  date: '2026-09-07',
  title: 'Safety net under Create Job from estimate',
  kind: 'fix',
  highlights: [
    'Turning an accepted estimate into a job now has 6 tests pinning which lines become fixtures, what the previewed bid is, when the action is refused, and what the job is created with; no behaviour change.',
  ],
}

export default note
