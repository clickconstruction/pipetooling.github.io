import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8356',
  date: '2026-11-23',
  title: 'Working hours: the clock follows a person\'s own start and end',
  kind: 'feature',
  highlights: [
    'A salaried person whose schedule clocks them in and out now gets sessions at their own working hours. A six-hour day runs six hours on the clock, where it ran eight.',
    'A day with a lunch makes two sessions with the break between. A day off makes none. A Saturday with hours is made.',
    'Hours saved during a day reach the clock from the next day, so a session already running is never moved.',
    'The Calendar and the team strip draw the same hours. A person with no working hours keeps their 8-hour day as before.',
  ],
}

export default note
