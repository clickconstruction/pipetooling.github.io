import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7049',
  date: '2026-11-12',
  title: 'Bills sent: one list of every bill that left, who got it and the minute it went',
  kind: 'feature',
  highlights: [
    'A new page, Bills sent, lists every bill the app sent, newest first, with a band for each day.',
    'Each line says the time, the bill, the job, the amount, the address it went to and who pressed send. Copy as sent opens the email as the customer read it.',
    'A bill sent twice shows two lines. The second says which send it is and the day of the first. A day\u2019s total counts each bill once.',
    'Open it at /bills-sent and bookmark it, or from Documents, Sent copies, Bills. The office, the owner and developers see it.',
  ],
}

export default note
