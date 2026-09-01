import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2576',
  date: '2026-09-01',
  title: 'Invoice lines on the Pipeline board get the same Edit button as job lines',
  kind: 'feature',
  highlights: [
    'Green invoice lines on Jobs → Pipeline now carry the same full-width Edit button their job lines have — the little edit and job-detail icons are gone.',
    'The job name on an invoice line is now a link that opens Job detail, just like on every other row.',
  ],
}

export default note
