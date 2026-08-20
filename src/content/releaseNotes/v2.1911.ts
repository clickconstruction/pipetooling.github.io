import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1911',
  date: '2026-08-20',
  title: 'The Ledger becomes the money view',
  kind: 'feature',
  highlights: [
    'The Estimates Ledger gains filters — estimates vs change orders, a date range (90 days by default), and an option to include superseded and declined rows.',
    'A totals footer answers the money questions from whatever you\'ve filtered: accepted this month, outstanding sent value, and accepted dollars not yet on a job (red when that isn\'t zero).',
  ],
}

export default note
