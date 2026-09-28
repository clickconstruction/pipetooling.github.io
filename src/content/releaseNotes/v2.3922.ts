import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3922',
  date: '2026-09-27',
  title: 'Edit Job: the job total and the paid sum are figured in one place',
  kind: 'fix',
  highlights: [
    'The job form worked out what a job is worth (line items plus hazmat fees) in four places and what has been paid in five. All of them now read one tested rule, so they cannot drift apart.',
    'The Job Total itself, and the numbers the “Remove payment?” confirm shows, have tests of their own.',
    'Nothing on screen changes.',
  ],
}

export default note
