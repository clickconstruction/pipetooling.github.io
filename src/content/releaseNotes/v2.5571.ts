import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5571',
  date: '2026-10-15',
  title: 'Schedule and Jobs: every job stays on the list as the ledger grows',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'The Schedule Dispatch hub reads the whole jobs ledger for its Jobs tab, the Add job to schedule picker and the block titles. The database answers a read like that with its first thousand rows and no warning, and the ledger is at 871 jobs. Past a thousand, the lowest-numbered jobs would have vanished from the hub with nothing said.',
    'The hub now reads the ledger a page at a time until it has every job, so the list is complete at any size.',
    'The Jobs board, Job Summary and Dispatch mode read the ledger the same way now. Paid in Full was at 767 jobs, the next list that would have been cut short.',
  ],
}

export default note
