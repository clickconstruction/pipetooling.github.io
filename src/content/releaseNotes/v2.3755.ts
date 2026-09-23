import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3755',
  date: '2026-09-23',
  title: 'Ready to Bill on a stage-billed job: Confirm works, and the stage bill stays billed',
  kind: 'fix',
  highlights: [
    'On the Jobs Pipeline, a Working job that already had a stage bill out could not be moved to Ready to Bill: both boxes ticked, Confirm looked live, and nothing happened. Behind the dialog the app was trying to pull back the job’s billed lines first — the move meant for a send-back from Billed Awaiting Payment — and the bill with a payment on it refused, into a message the board never showed.',
    'Now Ready to Bill from Working leaves every bill on the job exactly as it is: the stage bill stays billed, its payments stay applied, and the job moves. Only a send-back from Billed Awaiting Payment voids or removes bills, as before.',
    'When a move to Ready to Bill is refused for any reason — not signed in, a bill that cannot be voided, a permission the job’s owner has not given — the reason now appears as a message on the board instead of a Confirm that does nothing.',
  ],
}

export default note
