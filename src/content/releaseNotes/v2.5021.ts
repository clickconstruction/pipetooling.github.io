import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5021',
  date: '2026-10-09',
  title: 'Stages: the last stage’s bill takes the discount with it',
  kind: 'fix',
  highlights: [
    'Bill it on the last in-order stage now puts the job’s discount on that final bill, so the discount reads billed instead of no draw.',
    'The money is the same: each stage’s bill already carried its share of the discount.',
  ],
}

export default note
