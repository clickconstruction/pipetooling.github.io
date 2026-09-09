import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3183',
  date: '2026-09-08',
  title: 'Job search results line up their money',
  kind: 'feature',
  highlights: [
    'Every job result now reads the same way on the right: a note, the Pipeline chip, then the amount — in fixed columns, so the numbers stack straight down the list.',
    'Every result gets an amount. Jobs with no line items show their job total instead of nothing; a genuine no-charge visit shows a quiet $0; only a job with no total anywhere shows —.',
    'The note only speaks when the chip hasn’t: "6 mo ago" beside Paid, "unpaid 47d" beside Billed (red once flagged for collections). Waiting and Working rows no longer say "unpaid" — they were never billed.',
  ],
}

export default note
