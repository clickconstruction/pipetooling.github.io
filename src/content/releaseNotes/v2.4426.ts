import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4426',
  date: '2026-10-02',
  title: 'Dashboard and Calendar: a promised bid call shows on its day',
  kind: 'feature',
  highlights: [
    'When a day you picked to call a GC again arrives, the Dashboard’s Needs You card says how many bid follow-ups are due, names the builders, and opens the Call queue.',
    'A missed day turns that card red and says how many are past the day.',
    'The Calendar shows each promised call on its day, in the month grid, the day window and the Upcoming list.',
  ],
}

export default note
