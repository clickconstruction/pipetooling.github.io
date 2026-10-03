import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4476',
  date: '2026-10-03',
  title: 'Robot runs, bank checks and trials: an evening stamp keeps its day',
  kind: 'fix',
  highlights: [
    'A robot run, key or twin seat older than two weeks showed the next day when it came after 7 pm Central. The run’s hover showed the time in UTC. Both now read the company’s clock.',
    'A missing deposit on the Mercury check in Banking read the next day for an evening posting.',
    'Keep trying on a hiring trial, pressed in the evening, read the next day.',
  ],
}

export default note
