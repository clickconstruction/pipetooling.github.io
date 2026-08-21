import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1955',
  date: '2026-08-21',
  title: 'Pick which charges go on a partner statement',
  kind: 'feature',
  highlights: [
    'The Close-week card on Partnerships → Statements now lists every pending charge with a checkbox — uncheck one and it stays pending for a later statement instead of landing on this one.',
    'Everything is checked by default, so the one-click close works exactly as before.',
  ],
}

export default note
