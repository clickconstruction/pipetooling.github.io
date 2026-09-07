import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3029',
  date: '2026-09-07',
  title: 'Safety net under Apply Schedule %',
  kind: 'fix',
  highlights: [
    'Apply Schedule % on a clock session — splitting it across the day’s scheduled jobs — now has 6 tests pinning when it declines, how the session is cut, and which segment gets which job; no behaviour change.',
  ],
}

export default note
