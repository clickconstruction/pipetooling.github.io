import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8083',
  date: '2026-11-20',
  title: 'Before we start: material that is overdue no longer reads ready',
  kind: 'fix',
  highlights: [
    'A bullet read from the order log called a line ready when its day to land was before our first day.',
    'It never looked at today. A line due weeks ago and still not on site read as ready.',
    'Such a line now reads open. It says how many lines are overdue and the oldest day one was due.',
  ],
}

export default note
