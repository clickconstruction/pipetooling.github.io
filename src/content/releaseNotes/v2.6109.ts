import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6109',
  date: '2026-10-29',
  title: 'The Bid Board fits the narrowest phones',
  kind: 'fix',
  highlights: [
    'On a 320-wide phone the Bid Board’s tools row wraps: the search and the development filter share the first line, and Marked, Archived, Reply book and Customer review take the next line at the right. The page no longer scrolls sideways there.',
    'Wider phones and desks draw the row as before, on one line.',
  ],
  roles: ['estimator', 'assistant', 'controller', 'master_technician', 'dev'],
}

export default note
