import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7285',
  date: '2026-11-14',
  title: 'The job window on a phone: the Costs tab as rows',
  kind: 'feature',
  highlights: [
    'On a phone the Costs tab keeps its four numbers first, then folds the cost-against-value chart behind Show the chart, since its axes do not read at phone width.',
    'Where the money went is rows on a phone, not a table: the source at the left, the hours and the cost at the right, and the share as a bar under each row. A row that opens something says so and is a thumb-sized press.',
    'The dev’s Every cost row on this job panel folds behind Move cost rows… on a phone and draws nothing until opened.',
  ],
}

export default note
