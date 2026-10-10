import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5200',
  date: '2026-10-10',
  title: 'GC mode: a trade partner sees its own schedule in its portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'On a job we are building, a trade partner’s portal opens the job on its own schedule.',
    'It shows its own work, the work right before it and the work waiting on it.',
    'Other companies show by name and percent, never by price, and never their notes or contacts.',
  ],
}

export default note
