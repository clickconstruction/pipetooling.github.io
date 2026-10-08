import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4891',
  date: '2026-10-07',
  title: 'Downloaded files are named for today, even in the evening',
  kind: 'fix',
  highlights: [
    'A file downloaded after 7 PM was named with tomorrow\'s date. The AIA workbook, the bid counts and pricing CSVs, the job summary drill-down, the accountant\'s list and the Settings backups now carry the company\'s date.',
  ],
}

export default note
