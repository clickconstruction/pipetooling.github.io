import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5005',
  date: '2026-10-08',
  title: 'GC projects: the contract’s late fee, and each job’s finish against it',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Bill the customer has Late fee in its terms: the fee a day the contract charges past substantial completion.',
    'The window reads the job’s schedule and says which finish counts. That is the day we reached substantial completion, or the projected finish until then.',
    'With a fee typed, it says what the late days cost and whose they are.',
    'Money shows each job’s late finish. A job with no schedule says so in one line.',
  ],
}

export default note
