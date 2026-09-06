import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2947',
  date: '2026-09-06',
  title: 'Visits scheduled on a bid can follow the job it became',
  kind: 'feature',
  highlights: [
    'When a won bid has a job and dispatch had already scheduled visits against the bid, Edit Bid\'s Job block now says so — "2 scheduled visits still sit on the bid (1 upcoming)" — with a "Move them to J1007" button.',
    'Tap and confirm: the visits keep their crew, date and time and now belong to the job on the Schedule hub and the job\'s week. Nothing moves unless you tap.',
    'Shown to the roles that edit the schedule (dev, master, assistant, controller).',
  ],
}

export default note
