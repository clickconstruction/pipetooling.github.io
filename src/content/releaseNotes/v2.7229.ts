import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7229',
  date: '2026-11-13',
  title: 'The dev seat records a lien notice that was already mailed',
  kind: 'feature',
  highlights: [
    'A notice mailed by hand can now be recorded from the dev seat, the same way the Lien desk records it with "Already mailed? Record it…".',
    'One mailed paper can go on record for several jobs at a property. Each job keeps its own share, and the paper\'s total is kept beside it.',
    'The seat types the paper as it went. A notice sent to the owner alone is recorded as sent to the owner alone.',
    'It refuses a job that already holds that mailing. It mails nothing and drafts nothing.',
  ],
}

export default note
