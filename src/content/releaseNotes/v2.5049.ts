import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5049',
  date: '2026-10-09',
  title: 'GC mode: the emails about a trade partner’s charges and changes, and what waits on the office',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The emails a trade partner gets about a charge are written: when it goes out, when we keep or drop it, and when it comes off a draw.',
    'So are the emails about a change it asked for: turned down, sent to the customer, or refused by the customer. They show only the company’s part.',
    'Each one reads in the company’s language and sends once.',
    'The dashboard can now find the charges and change requests waiting on us. The screens that send and show them come next.',
  ],
}

export default note
