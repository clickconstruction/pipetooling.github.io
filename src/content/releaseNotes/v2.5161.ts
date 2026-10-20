import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5161',
  date: '2026-10-10',
  title: 'GC mode: the schedule reads the daily log',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A GC job’s schedule now reads its daily logs. Weather the log names shows as lost days on the bars it held up.',
    'The finish with weather and crews, and people on site, count the crews the logs name. Our own crew’s count comes from its clock-ins.',
    'Walking the schedule offers Add the lost days on work the weather held up. The new finish and the log’s words are filled in.',
  ],
}

export default note
