import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5157',
  date: '2026-10-10',
  title: 'GC mode: Get started, one window before a job starts',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Get started on a won GC job lists what must be in before work starts, and Start stays shut until it is.',
    'Start moves the job to building and emails each trade awarded on it. Start anyway keeps why and what is still owed.',
    'A trade’s statement of work now waits until its master agreement, insurance and W-9 are in.',
    'A trade we do ourselves now counts our own bid’s price once it is priced.',
  ],
}

export default note
