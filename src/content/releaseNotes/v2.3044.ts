import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3044',
  date: '2026-09-07',
  title: 'Safety net under Prospects team activity',
  kind: 'fix',
  highlights: [
    'The thirty-day calling activity on Prospects → Team and the Quickfill chart now has 4 tests pinning who is counted, which days, and that a prospect touched twice in a day counts once; no behaviour change.',
  ],
}

export default note
