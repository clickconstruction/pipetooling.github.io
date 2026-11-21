import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8152',
  date: '2026-11-20',
  title: 'Document builder: a sent sheet’s copy no longer holds the trade’s page link',
  kind: 'fix',
  highlights: [
    'The copy of a sheet’s email under Sent copies shows the trade’s page link cut short, as every other trade email’s copy does.',
    'It used to keep the whole link. That link opens the trade’s page with no login, and the whole office reads Sent copies.',
    'The sheet’s own link stays in the copy. That one is made to be handed on.',
  ],
}

export default note
