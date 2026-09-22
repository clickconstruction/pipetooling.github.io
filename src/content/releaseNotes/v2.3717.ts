import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3717',
  date: '2026-09-22',
  title: 'Pay: say how each payment was sent, and see it on the Payments view',
  kind: 'feature',
  highlights: [
    'Record payment on a pay-run row, and Record one payment on Balances, now ask how it was sent: Cash App, Mercury, Apple Pay, Client direct or Other. Pick Cash App and the transaction-id box opens, the # added for you if you leave it off.',
    'The Payments view on the Payroll tab has a Method column that sorts, and a row of chips that filters to one method with its count. A payment recorded before this wears a dashed chip when its memo says the method, and nothing when it does not.',
    'The Cash App reconcile’s Record and Split oldest first carry the send on the payment the same way, and recording the same Cash App send on the same week twice is refused in plain words.',
  ],
}

export default note
