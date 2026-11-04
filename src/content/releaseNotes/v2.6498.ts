import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6498',
  date: '2026-11-04',
  title: 'The Development page’s cost timeline shows the overhead landed on the site',
  kind: 'feature',
  roles: ['dev', 'controller'],
  highlights: [
    'The Timeline on the Money look gains the amber band: the office overhead landed on the site’s jobs so far, stacked on cost, with the true cost reading on top.',
    'The band lands day by day from the same ledger the Scoreboard’s Overhead column and the Job window’s Burn read, from the day the office pool began.',
    'The chart draws its cost and cash lines first and the band as soon as the ledger is in. A chip narrows the band to that job’s own days.',
  ],
}

export default note
