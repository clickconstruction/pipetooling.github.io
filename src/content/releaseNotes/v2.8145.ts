import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8145',
  date: '2026-11-20',
  title: 'Papers before a job opens: the ground for a job’s own settings',
  kind: 'feature',
  highlights: [
    'A job can now carry the settings of a paper built from settings, in the database. Until someone signs, the office can change them.',
    'After the first signature the settings are locked. A change then can only make the paper stricter, and everyone signs again.',
    'Only a ZZ Test job takes such a paper before an attorney has read it. A signed copy keeps its settings and a seal of its words.',
    'Nothing changes on any screen yet, and no real job has such a paper. Every other paper works as before.',
  ],
}

export default note
