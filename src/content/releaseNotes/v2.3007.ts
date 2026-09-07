import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3007',
  date: '2026-09-07',
  title: 'Safety net under Job Follow-Up',
  kind: 'fix',
  highlights: [
    'Job Follow-Up Mode’s settings, review history, candidate deck and "Put back in queue" now have 10 tests pinning what is read and written and how a missing piece degrades; no behaviour change.',
  ],
}

export default note
