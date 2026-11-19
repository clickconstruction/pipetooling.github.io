import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7910',
  date: '2026-11-19',
  title: 'The pace card: work that is not a stage is one row',
  kind: 'fix',
  highlights: [
    'A superintendent’s pace card lists the job’s stages top to bottom. It also listed every other line of the bid, by the name the office gave it.',
    'Those lines are now one last row, Other work. A long description or an office note on a bid line no longer shows on the crew’s phone.',
    'The stages, the hours bar and the finish day read as before. A job whose bid has no stages shows its one Work bar.',
  ],
}

export default note
