import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4864',
  date: '2026-10-07',
  title: 'Labor: hours you typed stay when a fixture leaves the counts',
  kind: 'fix',
  highlights: [
    'Switch a bid to a version without a fixture, or re-import with new names, and its labor hours are no longer deleted.',
    'They wait under the grid in Hours not on the counts, out of every total. Use for puts them on a counted fixture. Remove lets them go.',
    'Count the fixture again, or switch back, and its hours come back by themselves. A name that changed only in capitals, spaces or a group prefix keeps its hours.',
  ],
  roles: ['estimator', 'master_technician', 'assistant', 'dev'],
}

export default note
