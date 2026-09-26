import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3867',
  date: '2026-09-26',
  title: 'Estimates: what a draft save writes has a test',
  kind: 'fix',
  highlights: [
    'The exact record a draft estimate saves — and the one the autosave compares against to know whether anything changed — was assembled inside the Estimates page with no test. It now lives in one small module with seven: the title that fills in by kind, the total and lines that follow the recommended option when options exist, the blanks that save as empty, the notify list de-duplicated, and the change-order fields written only on a change order.',
    'Nothing on screen changes; every save writes what it wrote before.',
  ],
}

export default note
