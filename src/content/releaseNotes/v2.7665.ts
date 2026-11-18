import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7665',
  date: '2026-11-17',
  title: 'Papers before a job opens: lists, searches, pushes and schedule emails keep a locked job to its number',
  kind: 'feature',
  highlights: [
    'The clock in list, job search and the Dashboard’s job lists now show a job you owe a paper on by its number alone. This comes from the database, not only the screen.',
    'A locked job no longer answers a search by its name or its address. You find it by its number.',
    'A person locked out of a job gets no push about it, and their schedule email shows its number and time only.',
    'The note saying the prompt was the only lock is gone. The database holds the lock for crew and subs.',
  ],
}

export default note
