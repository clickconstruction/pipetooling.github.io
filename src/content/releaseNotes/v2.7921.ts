import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7921',
  date: '2026-11-19',
  title: 'A primary’s money actions hold to their own jobs',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'A primary could write down or delete a bill, move a payment, or send a paid job back to billed on a job that was not theirs. No screen offered it, but the database allowed it.',
    'Now those actions work only on jobs where the primary is the account manager, sold the job, or wrote its signed estimate.',
    'A primary makes a job only from an estimate they wrote. Everyone else works as before.',
  ],
}

export default note
