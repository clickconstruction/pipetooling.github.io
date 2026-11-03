import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6471',
  date: '2026-11-03',
  title: 'The Job Summary’s premium total leaves out a job whose premium waits',
  kind: 'fix',
  roles: ['dev', 'controller', 'master_technician'],
  highlights: [
    'A job’s premium waits while any of its days price at nothing. The totals row and each Cut by group now add only the premiums that exist, instead of counting a waiting one as zero.',
    'When every job’s premium waits, the total reads a dash, not $0.00. Hover it to see how many jobs it leaves out.',
  ],
}

export default note
