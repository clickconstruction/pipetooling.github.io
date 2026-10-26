import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5891',
  date: '2026-10-26',
  title: 'Accounts Receivable: the new check that arrives inside a bigger payment',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'A returned check’s case used to wait for a deposit of the exact amount, untouched. A payer who folds the new check into one payment with other bills never sends one, so the case waited forever.',
    'The case now notices when a same-payer payment’s money on the check’s own job covers the check. A green note names the payment, who applied the money and when, with one press: This payment made it good.',
    'The press reads back what closes, says whether the $30 returned check fee is on, and closes the case naming that payment. Nothing moves on the job, and Reopen still undoes it.',
    'The same offer appears right after an Apply that covers a waiting check. A payment that covers only part of the check leaves the case open.',
  ],
}

export default note
