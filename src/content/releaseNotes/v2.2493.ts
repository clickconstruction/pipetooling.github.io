import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2493',
  date: '2026-08-29',
  title: 'The "Needs you" card ranks worst-first',
  kind: 'feature',
  highlights: [
    'Items now sort by how much they need you: red alerts first, then money waiting to be applied, then the weekly GC deadline, then work queues (biggest pile first), with hygiene items last.',
    'Walk the list follows the same order — walking from the top always tackles the worst thing next.',
    'Same ordering on the Dashboard and on Quickfill\'s Needs you station.',
  ],
}

export default note
