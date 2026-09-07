import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2980',
  date: '2026-09-06',
  title: 'Safety net under Won / Lost on a GC packet',
  kind: 'fix',
  highlights: [
    'Marking a GC packet Won, Lost or back to waiting — and the cascade a win sets off (siblings lost, the bid rolled up, the note, the undo) — now has 14 tests pinning exactly what gets written and in what order.',
    'The tests caught that the outcome date was built in a way some runtimes render as 09/06/2026 instead of 2026-09-06; browsers were fine, and it now uses the same date formatter the rest of the app trusts.',
  ],
}

export default note
