import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3529',
  date: '2026-09-16',
  title: 'Accounts Receivable: close out money that has no bill',
  kind: 'feature',
  highlights: [
    'Bank interest, a vendor refund or an owner deposit has no job to land on. A new strip on an untouched deposit asks Not a customer’s payment? — pick the reason and the deposit leaves To match with the reason on the record.',
    'The reason is suggested from the bank’s own words when they say it (interest, refund). Something else asks for a note.',
    'Closed-out deposits keep a chip under To match · All and can be reopened from the header. Nothing is written to a job; Banking’s label still books the money.',
    'The Dashboard’s Match deposits count drops with it.',
  ],
}

export default note
