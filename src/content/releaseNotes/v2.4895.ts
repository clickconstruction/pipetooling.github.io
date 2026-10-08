import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4895',
  date: '2026-10-08',
  title: 'Payments: move one to the right job right after you type it',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A payment you just typed in is saved a moment later, and its ⋯ menu now offers Move to job… straight away. Before, you had to close the job and open it again.',
    'The Why box in Move this payment starts empty, with wrong job as a hint. What you type is what the line under the job says. Before, your words ran onto the end of wrong job.',
  ],
}

export default note
