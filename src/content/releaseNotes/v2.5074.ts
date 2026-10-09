import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5074',
  date: '2026-10-09',
  title: 'GC mode: change a bar in its form, and move one part of a split bar',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Pressing a bar on a GC project’s schedule opens its form for a dev: its days, the day it cannot start before, the day it must finish by, and what it waits on with a gap.',
    'A change in the form asks why it moved, like a drag, and the form shows what a slip of 5 or 10 days would do.',
    'The form keeps the days the work really ran, and one part of a split bar can be dragged on its own.',
  ],
}

export default note
