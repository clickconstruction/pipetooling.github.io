import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7037',
  date: '2026-11-12',
  title: 'Pay calendar: the forecast opens with the cutoffs coming',
  kind: 'feature',
  highlights: [
    'The payment forecast opens with Cutoffs coming: each payer on a pay calendar with work not yet billed, and its next cutoff.',
    'Each line says the dollars ready to send and the dollars still to bill on jobs being worked. The nearest cutoff comes first.',
    'A Working row for such a payer reads Bill by Nov 30 to be due Dec 10 in the cutoff’s last 10 days.',
    'A line turns amber in the cutoff’s last 7 days. A payer with no calendar, or with nothing left to bill, is not listed.',
  ],
}

export default note
