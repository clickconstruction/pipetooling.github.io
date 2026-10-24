import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5814',
  date: '2026-10-24',
  title: 'Quickfill Email: the groundwork for a station that reads Gmail’s own labels',
  kind: 'feature',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'The Email station is on its way to reading Gmail itself instead of asking for a retyped list: for each box and each label it will show the live count, how old the oldest thread is, the threads that have sat past the limit with the day they arrived, and what moved since the last look.',
    'This first step lays the ground: where the app keeps the list of boxes and labels it counts, the threads it saw (sender, subject and dates, never the words) and the day-by-day trend. Nothing shows on the station yet.',
    'The stance is built in: a shared box shows to the office team; a person’s own mailbox shows to that person and to the one lead the owner names, and to nobody else.',
  ],
}

export default note
