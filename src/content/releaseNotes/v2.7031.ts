import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7031',
  date: '2026-11-12',
  title: 'Pay calendar: a bill not yet sent says its cutoff',
  kind: 'feature',
  highlights: [
    'A Ready to Bill row for a payer on a pay calendar reads: Send by Nov 30 to be due Dec 10. After that, Jan 10.',
    'The line is blue while the cutoff is far and amber in its last 7 days. Its first sentence opens the calendar.',
    'The Ready to Bill header shows the nearest cutoff and how many bills it holds.',
    'Bill Customer says what sending today makes the bill, and what waiting past the cutoff costs. It never stops a send.',
  ],
}

export default note
