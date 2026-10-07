import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4861',
  date: '2026-10-07',
  title: 'Recently deleted: a removed bid keeps its quoted costs, splits and submittal ticks',
  kind: 'fix',
  highlights: [
    'When a count row or a whole bid is removed, its quoted costs, takeoff stage splits and submittal picks are now kept in Recently deleted with the rest of it.',
    'Putting the bid back brings them back too. Before, they were gone for good.',
  ],
  roles: ['dev'],
}

export default note
