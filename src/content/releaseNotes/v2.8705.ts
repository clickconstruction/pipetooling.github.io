import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8705',
  date: '2026-11-27',
  title: 'The clock-in sheet asks which job or bid to charge',
  kind: 'fix',
  highlights: [
    'The clock-in sheet asked “What job or bid should we change for your time?”',
    'It now asks “What job or bid should we charge for your time?”, which is what it meant.',
    'Nothing else on the sheet changes.',
  ],
}

export default note
