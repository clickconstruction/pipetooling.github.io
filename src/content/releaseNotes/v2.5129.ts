import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5129',
  date: '2026-10-09',
  title: 'Jobs: a turnaway trip charge stays in the job’s total',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A trip charge raised the job’s total, but the next money edit in Edit Job, a discount, a tip from a deposit or a line added in Collect Payment took it out again while its bill kept it. The total now keeps it, as it keeps a hazmat fee or a returned check fee.',
    'Edit Job’s Job Total shows the trip charge with the riders, and the Bill tab no longer reads the trip charge as money covering a line that is not billed.',
    'Deleting a trip charge’s bill now takes the trip charge out of the total at the next change.',
  ],
}

export default note
