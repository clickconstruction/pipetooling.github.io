import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6126',
  date: '2026-10-30',
  title: "A Note or a Walk report's Save no longer names a job percent",
  kind: 'fix',
  highlights: [
    'On a phone the field report’s Save button names what it writes. A Note or a Walk files no percent, so its Save now reads Save report, or Save report · 1 photo, instead of Save · job 0%.',
    'A Status report still reads Save · job 36% · 2 photos, as before. Nothing about what a report files has changed.',
  ],
  roles: ['subcontractor', 'helpers', 'superintendent', 'master_technician', 'primary'],
}

export default note
