import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5776',
  date: '2026-10-23',
  title: 'Quickfill: Fill them in settles the jobs that bought with no job account',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'The Fill them in deck on Quickfill’s Needs you station now walks the jobs that bought parts at a house with no job account on record, one job and house at a time, with the rep to call and what is still unpaid.',
    'Three answers: it is on our account there, we asked the house for one, or no account is needed. Opened asks how and the house’s reference. Not needed asks why.',
    'Save and next writes the same row the Mark opened sheet writes, and flags the job’s invoices at that house on the account. Undo puts back what was there. The job-accounts line’s button now reads Fill them in.',
  ],
}

export default note
