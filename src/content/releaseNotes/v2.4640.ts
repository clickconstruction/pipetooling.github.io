import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4640',
  date: '2026-10-05',
  title: 'Legal portal: every act from the firm carries a date and a name',
  kind: 'feature',
  highlights: [
    'The law firm sets the date a fee, step or payment happened. It starts as today.',
    'Each act names who at the firm recorded it, picked from the firm’s own email list. The name shows on the Legal desk’s tables.',
    'A double click or a retry after a dropped connection saves once.',
    'The hourly limit is now per matter, so a month of costs on one matter no longer locks the firm out of the others.',
  ],
}

export default note
