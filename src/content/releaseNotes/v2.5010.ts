import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5010',
  date: '2026-10-09',
  title: 'Dashboard and customers: a payment with no bill picked counts there too',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A payment put on a job with no bill picked now counts against that job’s bills on the Dashboard, the Customer Hub, the customer timeline and the Customers list. The Pipeline already counted it this way.',
    'The money first pays any part of the job that was never billed, then the oldest bills. Every page now shows the same amount owed for such a job.',
  ],
}

export default note
