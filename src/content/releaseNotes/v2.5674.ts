import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5674',
  date: '2026-10-20',
  title: 'Reports: the how? table under the lines adds up',
  kind: 'fix',
  highlights: [
    'Under the lines list on a report, how? shows each line’s share of the job and its points. The points were rounded one line at a time, so on some jobs they summed to one more or one less than the job’s number below them.',
    'Now the points are whole numbers that add up to the job’s number exactly. The job’s number itself is unchanged; it is still what the report saves.',
  ],
}

export default note
