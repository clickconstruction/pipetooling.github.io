import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3306',
  date: '2026-09-11',
  title: 'Settings → Data: link the jobs that already match a won bid',
  kind: 'feature',
  highlights: [
    'A dev-only list under Settings → Data & recovery pairs every unlinked job with the won bid whose value equals its price to the dollar. Link one row with a confirm, or Link all unambiguous at once; a job that matches two bids (or a bid that matches two jobs) waits for a person. Each link stamps the job with the bid and takes the bid’s estimate as the job’s budget.',
  ],
}

export default note
