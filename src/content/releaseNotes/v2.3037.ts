import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3037',
  date: '2026-09-07',
  title: 'Robots: a voided shadow now actually stays voided',
  kind: 'fix',
  highlights: [
    'Marking a robot shadow as void — wrong division, wrong reference, spoiled run — was refused by the database on its first real use; the status list now includes it.',
  ],
}

export default note
