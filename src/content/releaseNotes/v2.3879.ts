import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3879',
  date: '2026-09-27',
  title: 'Job window: the lien timeline sits above the History tab',
  kind: 'feature',
  highlights: [
    'While a job still owes money, or a lien paper or demand letter is out, the History tab opens with the job’s lien timeline above its day grid: every deadline in order, whose move it is, the demand letter with its reply-by day, and a Waiting on line.',
    'It is the same strip the Lien window’s header draws, read the same way, so the two never disagree. A paid job with nothing out shows the grid alone, as before.',
  ],
}

export default note
