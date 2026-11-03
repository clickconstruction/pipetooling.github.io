import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6416',
  date: '2026-11-03',
  title: 'The Development page on a phone: the strip holds all six looks in its one row again',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When Photos joined as the sixth look, the phone’s strip of looks kept room for five, so Photos sat alone on a second row and the strip stood twice as tall.',
    'The strip is one row again, with a cell for each look. Each cell is as wide as its name, so no name is cut on a phone as narrow as 320 points.',
  ],
}

export default note
