import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3280',
  date: '2026-09-11',
  title: 'Payment promises are kept on record',
  kind: 'feature',
  highlights: [
    'When a customer names a date they will pay by, that promise is now kept forever — even after the date is changed or cleared. Changing the date on a bill records a second promise instead of erasing the first.',
    'Each promise remembers who at the customer said it, who on our side heard it, and when. Nothing changes in how you mark a promised date today: the link under the expected-pay chip and call mode both feed the record.',
    'Whether a promise was kept is worked out from the payments ledger under one rule: paid within three business days of the date is kept; later is late by that many days; unpaid a week past the date, or replaced by a new date, is broken.',
    'This is the foundation. Next: customers naming their own date from a past-due reminder, the record on every Billed row, and payment terms that follow a customer onto new bids and jobs. New help guide: "know whether a customer keeps their word".',
  ],
}

export default note
