import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6429',
  date: '2026-11-03',
  title: 'The Bridge dial’s marks read on a phone',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The pace dial’s marks (today, where the pile stops growing, where another crew pays) are labels under the slider. On a phone they were drawn on top of each other.',
    'Each label now takes the first row where it clears the one before it, measured on the screen, so no two overlap. A phone uses four rows where a desk uses two.',
    'Tablets and desks look the same as before.',
  ],
}

export default note
