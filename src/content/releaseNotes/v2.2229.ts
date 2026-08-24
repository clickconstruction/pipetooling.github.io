import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2229',
  date: '2026-08-24',
  title: 'Section tools menu shows the real Capable of Being Billed total',
  kind: 'fix',
  highlights: [
    'The jump-bar Section tools menu could say "Capable of Being Billed: $0" while the Working section was collapsed, even though the section header knew the real total.',
    'The menu now reads the same figure as the Working header, so the two always agree.',
  ],
}

export default note
