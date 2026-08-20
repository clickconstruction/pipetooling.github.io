import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1917',
  date: '2026-08-20',
  title: 'Faster, lighter Stages board stats',
  kind: 'fix',
  highlights: [
    'The board header chips now load only the jobs and billing lines they actually measure — completed history stays out of the request, so the page is lighter and the database works far less.',
    'Chips refresh immediately after you change a job, and skip redundant reloads when nothing has changed.',
  ],
}

export default note
