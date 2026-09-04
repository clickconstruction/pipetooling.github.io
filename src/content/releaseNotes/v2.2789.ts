import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2789',
  date: '2026-09-04',
  title: 'Sub portal: work orders show what they reference, and subs confirm before signing',
  kind: 'feature',
  highlights: [
    'A work order sent from a sheet shows the sub what\'s not included and a collapsed list of the documents it references, each with its version date, in English or Spanish.',
    'Before signing, the sub ticks each confirmation sentence the office set; the signature records exactly what they ticked.',
    'Signed sheets carry a "What you agreed to" line the sub can reopen any time.',
  ],
}

export default note
