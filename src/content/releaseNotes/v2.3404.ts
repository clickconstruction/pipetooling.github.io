import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3404',
  date: '2026-09-14',
  title: 'Builders entered as both customer and GC are now the GC only',
  kind: 'fix',
  highlights: [
    'The 72 jobs that carried the same builder in the customer row and the GC row (RMC- Dudley Mason, Knight Contracting, H & I, Michael Palmer and others) are now GC jobs: the builder is the GC, the customer row is empty, and the bills go to the GC as before.',
    'The database keeps it that way: any save that would make a job\'s customer and GC the same party lands as a GC job instead.',
  ],
}

export default note
