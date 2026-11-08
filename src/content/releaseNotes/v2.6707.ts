import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6707',
  date: '2026-11-08',
  title: 'The hours a person can work in a week now have a home in the database',
  kind: 'feature',
  highlights: [
    'Groundwork for Utilization: a table that keeps each person’s answer to “how many hours a week can you work, and when?”, as a drawn week or a plain number, from the Sunday it holds from. Nothing on screen changes yet; the board and My Time’s drawing land in the next two releases.',
    'Every answer is kept, never overwritten, so an old week will read against the hours that held then.',
  ],
}

export default note
