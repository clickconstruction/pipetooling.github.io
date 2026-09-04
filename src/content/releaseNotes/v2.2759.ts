import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2759',
  date: '2026-09-04',
  kind: 'fix',
  title: 'Upcoming payroll estimate counts every session again',
  highlights: [
    'The Dashboard\'s accounts-payable card, the Pay stubs header, and the Employment tab\'s pay totals estimate unpaid payroll from everyone\'s clock sessions since the oldest unpaid stub. Once that window grew to four months, the read quietly stopped at the first 1,000 sessions and the estimate ran low.',
    'The new row-cap tripwire caught it on its first day. The read now pages through every session, so the number is whole.',
  ],
}

export default note
