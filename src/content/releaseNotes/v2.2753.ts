import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2753',
  date: '2026-09-04',
  kind: 'fix',
  title: 'Bids Audits automated check no longer trips on a slow runner',
  highlights: [
    'One of our automated pre-deploy checks for the Bids → Audits tab occasionally read the audit card before its notes had loaded and reported a failure that was not real. The check now waits for the notes. No app behavior changed.',
  ],
}

export default note
