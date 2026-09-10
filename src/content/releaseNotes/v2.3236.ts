import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3236',
  date: '2026-09-10',
  title: 'Owner memo: pressing Post twice no longer posts the questions twice',
  kind: 'fix',
  highlights: [
    'If Post wrote the one-tap questions but lost the connection before retiring the original ask, pressing Post again now finds what was already posted, skips the duplicates, and only retires the original.',
  ],
}

export default note
