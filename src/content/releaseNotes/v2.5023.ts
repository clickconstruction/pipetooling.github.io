import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5023',
  date: '2026-10-09',
  title: 'Submittals: a design change says whose call it is and who signed off',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Edit on a design-change row asks whose call it is: Architect, Engineer, GC or Owner.',
    'It also records the sign-off: who signed off, the day, and how it came, such as by email or on a stamped drawing.',
    "The review room prints it under the row, like The engineer's call · signed off by Pat Lee on Oct 9, 2026, by email.",
    'The sign-off stays with the row when you split it, and carries to the next revision while the product stays the same.',
  ],
}

export default note
