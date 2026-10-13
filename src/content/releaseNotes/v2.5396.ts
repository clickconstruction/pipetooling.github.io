import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5396',
  date: '2026-10-12',
  title: 'Messages: the residential customer flow, from the booking to the review ask',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Groundwork for residential customers in Messages. Nothing changes on screen yet.',
    'A fifth flow follows a service job in eleven steps, from Booked to Review asked.',
    'Each step is read from what dispatch, the clock, the reports, the estimate, the job status and the bills already keep.',
    'Its two reminders, for the estimate and for the bill, stay off until the owner turns each one on.',
  ],
}

export default note
