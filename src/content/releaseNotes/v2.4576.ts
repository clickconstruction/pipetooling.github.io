import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4576',
  date: '2026-10-05',
  title: 'Accounts Receivable: Esc closes one thing at a time, and two smaller fixes',
  kind: 'fix',
  highlights: [
    'Esc now closes what is open over Accounts Receivable first: the bounced-check question, They said, or the exact-match review. A second Esc closes the window.',
    'Ticking Returned on a deposit no longer jumps you off the returned check you were working.',
    'A search that also looks in All now finishes when the list reloads under it. Before, the rows found in All stayed missing until you typed the search again.',
  ],
}

export default note
