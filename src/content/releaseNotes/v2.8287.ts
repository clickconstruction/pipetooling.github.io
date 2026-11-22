import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8287',
  date: '2026-11-22',
  title: 'Job Mode: Turnaway shows once you are on the clock for a job',
  kind: 'fix',
  highlights: [
    'Turnaway was on the Job Mode card all day, greyed out until you were on the clock for a job. It now shows only once you are.',
    'Nothing else about a turnaway changed. The form, the dispatch alert and the trip charge work as before.',
    'A job on today’s schedule can still be turned away from New Report, clocked in or not.',
  ],
}

export default note
