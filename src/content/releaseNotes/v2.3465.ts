import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3465',
  date: '2026-09-14',
  title: 'Submittals: the record behind the coming Submittals tab',
  kind: 'infra',
  highlights: [
    'Groundwork only — nothing new on screen yet. Each bid can now hold submittal revisions, one row per fixture tag (specified vs. submitted, status, reason, lead time, the cut-sheet pages), and a private file store for the vendor PDFs and the packages.',
    'The Submittals tab that reads and writes these rows is the next release.',
  ],
}

export default note
