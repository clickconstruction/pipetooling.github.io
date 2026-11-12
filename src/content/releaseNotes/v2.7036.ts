import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7036',
  date: '2026-11-12',
  title: 'Pay calendar: one job on its own calendar, and the day a payer accepted a bill',
  kind: 'feature',
  highlights: [
    'Opened from a job, the Pay calendar window can set a calendar for that job alone, or none for it.',
    'A job in a development can set the development’s other jobs with it. A job that fails is named, and the rest are saved.',
    'Under a billed row’s dates, Counted from Nov 24 opens They accepted it on… for a bill that was sent back.',
    'The window shows what each day makes the bill before you save: accepted a month later, it is due a month later.',
  ],
}

export default note
