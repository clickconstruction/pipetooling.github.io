import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5004',
  date: '2026-10-09',
  title: 'A property’s kind says Commercial everywhere',
  kind: 'fix',
  highlights: [
    'Edit Job’s Property record and the customer’s property sheet now say Commercial, the word the lien screens and the Pipeline’s C badge already use. They said Non-residential before.',
    'The Legal desk, the firm’s view and the firm’s printed packet say commercial too.',
    'Nothing else changes. Picking Commercial still clears Homestead, and the help guides show the new word.',
  ],
}

export default note
