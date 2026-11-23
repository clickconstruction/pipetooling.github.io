import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8371',
  date: '2026-11-23',
  title: 'Payments: the older Stripe payments made in the evening sit on the day they were made',
  kind: 'fix',
  highlights: [
    'Six Stripe payments made in the evening before the fix of November 23 were still filed on the next day. Each one now sits on the day it was made.',
    'No amount, bill or job changed. Three of them were Sunday-night payments filed on a Monday, so Weekly money now counts them in the week before.',
    'A paper or an email already sent keeps the day it said.',
  ],
}

export default note
