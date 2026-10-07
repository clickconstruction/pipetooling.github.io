import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4766',
  date: '2026-10-07',
  title: 'Lien desk: nothing shows through above the Deadlines date row',
  kind: 'fix',
  highlights: [
    'On Deadlines, the row of dates is a fixed row above the list. A scrolled row can no longer show in a strip between the pills and the dates.',
    'When one month bar reaches the top, the next bar slides over it. The old bar no longer shows its bottom half under the dates for a moment.',
  ],
}

export default note
