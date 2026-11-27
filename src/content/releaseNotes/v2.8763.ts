import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8763',
  date: '2026-11-27',
  title: 'Edit task: an old task says who has had it, and since when',
  kind: 'fix',
  highlights: [
    'In Edit task, a task given long ago read “Theo gets it on Tue, Feb 17.” for a day long past.',
    'A day that has passed now reads “Theo has had it since Tue, Feb 17.”',
    'A task for today or a day to come still reads “gets it”. A new task reads as it did.',
  ],
}

export default note
