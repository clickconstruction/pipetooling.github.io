import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3462',
  date: '2026-09-15',
  title: 'Pipeline: the Progress & payment column is wider, so “Done, not billed” never wraps',
  kind: 'fix',
  highlights: [
    'The Progress & payment column grows from 12rem to 14.5rem on every Pipeline table, and the legend’s labels never break onto a second line. “24% Done, not billed” and its amount now sit on one row like the others.',
  ],
}

export default note
