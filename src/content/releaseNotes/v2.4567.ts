import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4567',
  date: '2026-10-05',
  title: 'Lien releases: who signs starts fresh on each job',
  kind: 'fix',
  highlights: [
    'The Who signs choice on a lien release now starts from the job’s own leader every time the window opens.',
    'Before, a leader picked for one job stayed picked when you opened a release on the next job.',
  ],
}

export default note
