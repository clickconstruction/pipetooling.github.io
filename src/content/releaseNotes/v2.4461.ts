import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4461',
  date: '2026-10-02',
  title: 'Demand letters and printed invoices: a bill sent in the evening keeps its day',
  kind: 'fix',
  highlights: [
    'A bill marked billed or sent after 7 pm Central printed with the next day’s date. That was on the printed invoice, on a copy sent again by email and on the invoice enclosed with a notice.',
    'A demand letter counted from that next day too. Its statement of account, its invoice date and its notice history all did, and so did a re-send, a promise or a call logged in the evening.',
    'They now read the day on the company’s calendar.',
  ],
}

export default note
