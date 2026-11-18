import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7745',
  date: '2026-11-18',
  title: 'Pipeline: the man-hours on each row are read by their own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the code that reads the man-hours for each Pipeline row lives in its own file.',
    'Nothing changes on screen. The hours and the names behind them show as before.',
    'New tests cover when the hours are read, and what happens when the read fails.',
  ],
}

export default note
