import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8425',
  date: '2026-11-23',
  title: 'Bills sent: both views name the same person on a bill',
  kind: 'fix',
  highlights: [
    'By day paid now names who the bill went to, the same name By day sent shows. Before, it named the job’s customer, so one bill could carry two names.',
    'The printed month and the spreadsheet of payments carry the same name.',
  ],
}

export default note
