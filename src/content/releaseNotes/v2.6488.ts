import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6488',
  date: '2026-11-04',
  title: 'The dev seat reads every movement on a site and reports a full read truthfully, and one refused token no longer stops a whole OCR pass',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'read_on_site reads a job’s whole ledger again when 200 or more rows share one time stamp, as a 200-line delivery or count does; before, every row after that stamp was dropped in silence and a box could read 25 on hand with none in it.',
    'get_job no longer says a read stopped and the totals undercount on a job with exactly 5,000 card lines, supply lines or sheets: it looks one row past the cap before saying so.',
    'In a Drive index pass, one refused token exchange from Google no longer refuses every scan the pass reaches: the next scan mints the token again.',
    'A digital twin asking Drive’s door for a search is refused in true words, that it cannot search Drive, rather than told it cannot change Drive.',
  ],
}

export default note
