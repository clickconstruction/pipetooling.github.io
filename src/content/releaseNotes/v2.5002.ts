import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5002',
  date: '2026-10-08',
  title: 'GC projects: interest on late GC bills, set per job and shown on Money',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Bill the customer has Interest in its terms. Type a rate a month to charge interest on late bills. The field starts at 1.5, and nothing is saved until you press Save.',
    'Interest runs from the day after a bill falls due by the contract’s days to pay. A day the customer promises never moves it.',
    'Money shows each job’s interest: what has built up, what was billed, what they paid and what is left to bill.',
    'The weeks ahead now count a new customer’s next bill by the contract’s days to pay.',
  ],
}

export default note
