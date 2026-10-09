import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5006',
  date: '2026-10-09',
  title: 'Billed money: a payment with no bill picked now counts on the board, GC Review and the statement',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A payment put on a job with no bill picked now counts against that job’s bills on the Pipeline’s Billed money, GC Review and the GC statement. They read it the way the customer portal and the bill paper already did.',
    'The money first pays any part of the job that was never billed, then the oldest bills. A job with such a payment can show less owed than before.',
    'Before a statement goes out, Draft Message still names the jobs with money put on no bill. It now reads as a note, not a warning.',
    'The Dashboard, the Customer Hub and the Customers list follow in the next update.',
  ],
}

export default note
