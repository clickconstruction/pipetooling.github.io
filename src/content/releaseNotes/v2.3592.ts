import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3592',
  date: '2026-09-18',
  title: 'A payment with no bill attached pays the oldest bill first — everywhere',
  kind: 'fix',
  highlights: [
    "Most payments on the ledger are recorded on the job, not on a bill. Until now the bill's own paper credited such a payment against every open bill of the job (a job with three open bills read nothing due on all three), while the demand letter counted none of it. Both were wrong in opposite directions.",
    "Now one rule answers for all of them: a payment with no bill attached fills the earliest bill the customer received, then the next, and whatever is left over shows on the job as money on no bill. A bill that takes part of a larger payment says so on its paper (\"part of $10,000.00\").",
    "The bill's PDF and email, the demand letter and its exhibit, the Bill tab's rows and sum line, and the customer's portal all read the same share, so a balance can no longer differ by where you look.",
    'Bills already sent are corrected the next time they are viewed, printed or enclosed — nothing is stored from the old rendering and nothing needs re-sending.',
  ],
}

export default note
