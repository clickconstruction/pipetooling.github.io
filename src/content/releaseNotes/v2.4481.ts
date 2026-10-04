import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4481',
  date: '2026-10-03',
  title: 'Submittals: a robot that is not coming says so',
  kind: 'fix',
  highlights: [
    'An ask the robot has not picked up in a day now says the day you asked and what the robots are doing.',
    'It used to read The robot is queued… for days, with no date.',
    'The line says what to do by hand. Cancel reads Take the ask back, and Type or paste the schedule turns blue.',
    'The same note shows on a vendor PDF and on a reviewer’s file waiting on the robot.',
  ],
}

export default note
