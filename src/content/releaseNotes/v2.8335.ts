import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8335',
  date: '2026-11-23',
  title: 'Payments: a Stripe payment made in the evening is filed on the day it was made',
  kind: 'fix',
  highlights: [
    'A customer who paid a bill through Stripe in the evening was filed as paying the next day. The payment is now filed on the company’s own day.',
    'Everything that reads the paid day agrees from here on: the Dashboard’s Money in bar, the Bridge, Weekly money, a customer’s timeline and Bills sent.',
    'Payments already on record are not changed. A check recorded on a Stripe bill still keeps the day the office gives it.',
  ],
}

export default note
