import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3502',
  date: '2026-09-16',
  title: 'Supply houses: the database will accept a credit memo',
  kind: 'fix',
  highlights: [
    'Groundwork only — a supply house document can now be marked as an invoice or a credit, and only a credit may carry a negative amount.',
    'Nothing changes on screen until the next release, which adds the choice to the form.',
  ],
}

export default note
