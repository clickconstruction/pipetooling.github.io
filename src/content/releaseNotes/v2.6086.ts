import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6086',
  date: '2026-10-29',
  title: 'Quickfill: Fill them in works the supply-house move window',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'The Fill them in rows on Quickfill’s Today’s lines now include the supply-house charges still in their move window: current, unpaid, not on a job account, on one job. Soonest window first, each with the invoice, the day the window closes, the job account’s state and the rep to call.',
    'Three answers on each row. Moved, I called the house, flags the charge and confirms the ask, and takes the house’s reference when no account is on record. Ask the house by email sends the same request the move window sends. No job account needed marks the job’s account there not needed, with the reason.',
    'A job whose account at a house is marked not needed now leaves the move window everywhere: the Needs you line, the Accounts payable strip and the worked list. The server’s count follows once the migration is pushed.',
    'Save and next re-reads the line so the dollars and the count fall. Undo puts back a move or a not needed. An email cannot be unsent.',
  ],
}

export default note
