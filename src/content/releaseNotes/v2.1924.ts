import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1924',
  date: '2026-08-20',
  title: 'Billed rows predict when payment should arrive',
  kind: 'feature',
  highlights: [
    'Every row in Billed Awaiting Payment now carries an expected-payment chip: the bill date plus that customer\'s usual pay speed ("Expect pay ~Sep 8 · pays in ~35d").',
    'The chip turns red once a customer runs past their own norm ("12d past expected") — a sharper follow-up signal than the flat 30/90-day buckets.',
    'Customers with too little payment history use the company-wide average, and the chip says so.',
  ],
}

export default note
