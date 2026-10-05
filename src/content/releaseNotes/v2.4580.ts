import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4580',
  date: '2026-10-05',
  title: 'Accounts Receivable: a new check closes the returned one only when it pays the same job',
  kind: 'fix',
  highlights: [
    'Use it as the new check closes the returned check\'s case only when Apply still pays a job that check paid. Before, the case closed on the next Apply for that deposit, whatever bills were named by then.',
    'When none of the bills the old check paid is open, nothing fills and the app says so. You pick the bill yourself, and the case stays open.',
  ],
}

export default note
