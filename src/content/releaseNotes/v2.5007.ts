import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5007',
  date: '2026-10-09',
  title: 'Sub sheets: a backcharge stays on the sheet it was raised on',
  kind: 'fix',
  highlights: [
    'A backcharge can no longer be moved to another sheet. Its Move… now says it stays on the sheet it was raised on, and opens nothing.',
    'Payments still move as before. To take a backcharge off a sheet, use Remove. A removal can be undone for 30 days.',
  ],
}

export default note
