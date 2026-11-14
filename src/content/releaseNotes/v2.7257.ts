import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7257',
  date: '2026-11-14',
  title: 'Held for suppliers: a job paid in kind no longer says it is on the Lien desk',
  kind: 'fix',
  highlights: [
    'A job on an open in kind arrangement is off the Lien desk. On Materials, Held for suppliers no longer shows its "On the Lien desk" line either.',
    'Every other job keeps its line, with the same date and the same link to the desk.',
  ],
}

export default note
