import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3005',
  date: '2026-09-07',
  title: 'Safety net under the overhead numbers',
  kind: 'fix',
  highlights: [
    'The 90-day overhead scan behind People → Overhead, the Dashboard card and the Bridge now has 9 tests pinning its window, what it asks the database, and that its per-day dollars and averages reconcile by hand; no behaviour change.',
  ],
}

export default note
