import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3408',
  date: '2026-09-14',
  title: 'Pipeline: click “Progress & payment” to sort jobs by % complete',
  kind: 'feature',
  highlights: [
    'On Jobs → Pipeline, click the “Progress & payment” column title and every section reorders its rows from 0% done at the top to 100% at the bottom. Click it again for the usual job-number order.',
    'A “Sorted: % complete ×” chip sits beside the ⋯ button while the order is on; jobs with no percent recorded sit below the 100% jobs.',
    'It is a quick look, not a setting: leave the Pipeline and come back and the board is in its usual order again.',
  ],
}

export default note
