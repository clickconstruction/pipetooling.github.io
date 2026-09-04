import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2764',
  date: '2026-09-04',
  title: 'GC Review: Include Collections is on by default, next to Share all',
  kind: 'feature',
  highlights: [
    'The Include Collections box now starts ticked and sits to the left of Share all and Print all, so the report you see and share carries the collections jobs unless you untick it.',
    'Certifying a GC and the weekly statement rounds keep looking at active billing only — toggling the box never turns a certified GC into "changed since certified".',
  ],
}

export default note
