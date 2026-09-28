import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3947',
  date: '2026-09-27',
  title: 'Schedule: the message after adding a job to several cells has tests',
  kind: 'fix',
  highlights: [
    'After you add one job to several cells at once, the Schedule says how many blocks were added, skipped for overlap, or failed. That message now comes from one tested piece. It reads the same as before.',
  ],
}

export default note
