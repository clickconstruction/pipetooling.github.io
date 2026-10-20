import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5169',
  date: '2026-10-10',
  title: 'GC mode: try moves on a copy of the schedule',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Press What if… on a schedule to try moves on your own copy. Nobody else sees it.',
    'In the copy, a reason is optional. Pull the work earlier and Days back work there too.',
    'Keep puts the moves on the real schedule with their reasons, or Throw it away drops the copy.',
  ],
}

export default note
