import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8761',
  date: '2026-11-27',
  title: 'A space typed in a people search is a space again',
  kind: 'fix',
  highlights: [
    'In the people search on a new task, a job, a schedule block and Manage people, a space ticked the first person in the list and typed nothing.',
    'So a first and a last name ticked whoever stood first. A space now types a space.',
    'Enter still ticks the top match. After an arrow key lights a person, Space still ticks that person.',
  ],
}

export default note
