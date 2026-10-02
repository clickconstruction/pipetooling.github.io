import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4363',
  date: '2026-10-02',
  title: 'Accounts Receivable: Close out books the money in Banking too',
  kind: 'feature',
  highlights: [
    'Closing out a deposit that is not a customer’s payment now says how Banking books it. A rule’s label is read back, a waiting rule match is approved, and a label can be picked when nothing labels it.',
    'The reasons are four buttons. A payer’s last close-out picks the reason for their next deposit.',
    'Reopen takes off a label Close out put on. A parts refund points to Supply houses so the job’s cost drops.',
    'A deposit in To match that Banking books as an expense says so on its row.',
  ],
}

export default note
