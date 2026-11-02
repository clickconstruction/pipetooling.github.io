import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6308',
  date: '2026-11-01',
  title: 'Documents: the tab row in the order you use it',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'The tabs now read Search, Estimates, Bids, Jobs, Supply invoices, Sent copies, Photos, Company, Where files go. Search comes first, the four ledgers follow in the order money moves, and the office’s reference and setup tabs sit last.',
    'Bid proposals is now Bids, the word the rest of the app uses. Sent is now Sent copies, so the tab says what it holds.',
    'The Upload tab, which only said coming soon, is gone. An old link to it opens Estimates. Every other bookmark still lands on its tab.',
  ],
}

export default note
