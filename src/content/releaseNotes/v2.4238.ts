import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4238',
  date: '2026-09-30',
  title: 'Procurement log: the tag and the product share one Item column, so rows are shorter',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'On Submittals → Procure each row opens with the tag in bold and the product beside it, in one Item column. A long product name wraps across the wider cell, so a row that stood five lines tall now stands two or three.',
    'The supply house and the stage sit on one quiet line under the item.',
    'The printed sheet, the CSV and the Google Sheets copy carry the same single Item column, tag first.',
  ],
}

export default note
