import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3568',
  date: '2026-09-17',
  title: 'Supply houses: the aging map says how much of each cell is on a job account',
  kind: 'feature',
  highlights: [
    'On Materials → Supply houses → Accounts payable, each aging cell and the Owed column carry a teal "job acct" line for the dollars on the house\'s job account — the owner\'s debt to collect on, not Click\'s. The cell keeps the house\'s total, so the map still reads as the house\'s statement.',
    'A "Mark job-account invoices" toggle on the bar hides the lines; it appears only when a job-account invoice is unpaid.',
    'The three toggles on that bar (paid invoices, last payment, this one) now survive a refresh.',
  ],
}

export default note
