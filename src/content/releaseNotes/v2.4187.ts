import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4187',
  date: '2026-09-29',
  title: 'The review room’s rows are their own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The GC’s review page keeps the same look and behaviour; the part that draws the headline, the rows that differ and the fold of rows that match is now a component the office’s “See what the GC sees” pane can draw from a draft. Nothing changes for the reviewer.',
  ],
}

export default note
