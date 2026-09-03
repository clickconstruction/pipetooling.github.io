import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2724',
  date: '2026-09-03',
  title: 'Signed records now close with a proper signature block',
  kind: 'feature',
  highlights: [
    'Signed estimates and contracts no longer end in a greyed-out form. The signature sits in a slim "Signed electronically" frame with a short record ID, the printed name and time beside it, and one line for consent, how it was signed, and where from.',
    'The same block appears on the office record, the customer’s page, the printed copy and the PDF, so every copy of a signed agreement matches.',
  ],
}

export default note
