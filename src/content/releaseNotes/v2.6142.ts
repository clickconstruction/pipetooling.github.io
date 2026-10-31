import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6142',
  date: '2026-10-30',
  title: 'Tally’s Team queue can draw each person’s day as a strip, a prototype that is off until you turn it on',
  kind: 'feature',
  highlights: [
    'On Job Parts Tally → Team, a new Day strip button draws each card’s day: the clock sessions as bars in their job’s colour, the schedule as hollow bars, and each card purchase as a tick at the time it was swiped, with the hours under. Press a tick to jump to its line.',
    'A purchase inside a session’s bar gets a chip that names the job and says in JP101’s hours, and its Pick a job list leads with that job. A purchase in a gap says how far it fell from the clock, like 3 h after clock-out, and leads with nothing.',
    'The switch is off until you press it and is remembered on your device. Off, the queue reads exactly as before. Nothing about how a day is sorted or saved has changed.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
