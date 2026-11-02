import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6344',
  date: '2026-11-02',
  title: 'The Pipeline row opens the job’s plans, and the site’s History records a part switching sets',
  kind: 'feature',
  highlights: [
    'Every Pipeline row gains a plans icon beside the job folder. A job with one set opens it. A job with two or more opens a picker that lists the set it builds from first, the older sets and our as-builts, each with Open ↗, and a door to the Documents tab.',
    'A job that names no part yet keeps opening its old plans link from the same icon, so no row changes.',
    'When a part of a development switches the set it builds from, the site’s History gains one line per job on the part, the moment it happened, as whoever switched it: Plans · the Bunker now builds from Addendum 1, dated Oct 2, 2026 · replaces Issued set. Nobody types it.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'superintendent', 'primary'],
}

export default note
