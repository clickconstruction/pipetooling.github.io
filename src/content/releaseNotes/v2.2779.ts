import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2779',
  date: '2026-09-04',
  title: 'Statement round: the Dashboard row and morning email count certified GCs correctly',
  kind: 'fix',
  highlights: [
    'A GC with a single billed line was being read as "changed since certified" behind the scenes, so the Needs you row and the round email could miss GCs that GC Review showed as ready. Both now agree with the panel.',
  ],
}

export default note
