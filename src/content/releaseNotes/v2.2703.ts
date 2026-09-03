import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2703',
  date: '2026-09-03',
  kind: 'fix',
  title: 'Dates written in the evening now land on the right day',
  highlights: [
    'Contract signatures, Mark Paid, turnaway trip charges, lien filings, AIA applications, and RFQ dates used the UTC clock — after 7 PM Central they were stamped with tomorrow\'s date. They now use the company calendar day.',
    'Estimates stay valid through midnight Central on their last day (they used to expire at 7 PM).',
    'The People Review window follows the company calendar instead of the browser\'s time zone.',
    'A build check now blocks new code from taking "today" from the UTC clock.',
  ],
}

export default note
