import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2499',
  date: '2026-08-30',
  title: 'Plan sets can be filed straight from an existing Drive folder',
  kind: 'feature',
  highlights: [
    'Filing plans on a bid now accepts a Google Drive file link — the plans copy directly into the job folder, keeping their original filename.',
    'Share the source folder with the intake service account once, and every set inside it becomes fetchable.',
    'If a copy cannot complete, the job folder still lands and the response says exactly what to do.',
  ],
}

export default note
