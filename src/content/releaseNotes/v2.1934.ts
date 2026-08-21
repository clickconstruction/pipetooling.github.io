import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1934',
  date: '2026-08-21',
  title: 'Partner statements: close card knows what’s already closed',
  kind: 'fix',
  highlights: [
    'The Close-week card on Partnerships → Statements now checks the archive: once last week’s statement exists it shows "closed ✓" and when the next close opens, instead of a button that could only say "already exists".',
    'Older completed weeks with no statement now appear as one-tap generate chips, so a missed week can be closed late — through the same approval guard.',
  ],
}

export default note
