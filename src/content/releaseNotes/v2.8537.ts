import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8537',
  date: '2026-11-24',
  title: 'Lien desk: the claim shows its cents, as its bills and the notice do',
  kind: 'fix',
  highlights: [
    'On a notice, the claim read in whole dollars over bills that showed cents. A claim of $12,700.50 read $12,701 while the notice printed $12,700.50.',
    'The claim now shows its cents, drawn small: in Months on this job, under This notice, in the Months title row and on the strip’s Claim chip.',
    'The bills behind the claim, the Not billed yet line, the retainage line and an earlier notice’s amount show their cents the same way.',
    'Grace’s pick, answered by Diane on 2026-11-24 from pictures of both ways.',
  ],
}

export default note
