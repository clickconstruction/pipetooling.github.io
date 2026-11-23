import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8345',
  date: '2026-11-23',
  title: 'Working hours: the database can hold a start and an end for each day',
  kind: 'infra',
  highlights: [
    'The first step toward setting a person\'s working hours, like 6:00 AM to 12:00 PM on five days. Nothing on a screen changes yet.',
    'The database can now keep a week with a start and an end for each day, in 15-minute blocks, with a break in a day if there is one.',
    'Only a dev or the controller can set those hours. For a salaried person the paid hours follow in the same save, so the two cannot disagree.',
  ],
}

export default note
