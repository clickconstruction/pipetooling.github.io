import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3912',
  date: '2026-09-27',
  title: 'People → Users: the tab loads its own signals',
  kind: 'fix',
  highlights: [
    'Who has notifications on, each person’s contract-signing light and the active projects under a name are read when you open Users, not every time the People page opens on another tab.',
    'The People page no longer waits on the active-projects read before it shows.',
    'The Archived fold on Users starts closed each time you come back to the tab.',
  ],
}

export default note
