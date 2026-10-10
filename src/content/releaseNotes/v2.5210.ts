import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5210',
  date: '2026-10-10',
  title: 'GC mode: a trade partner works its schedule from its portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Under each of its own bars, a trade partner can say its work will be late, and see what the new day pushes back.',
    'It answers new dates we sent it, and keeps its day after we push back.',
    'It marks its next three weeks done or not done, and says how many people a day it sends.',
    'Needs you on its home lists each of these, and opens the job where it is.',
  ],
}

export default note
