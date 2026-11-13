import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7081',
  date: '2026-11-12',
  title: 'Bids: the pricing email names its price column Sale Price, as the window does',
  kind: 'fix',
  highlights: [
    'In Share with a teammate, the email from Send for me headed its price column "Unit price" while the preview in the window said "Sale Price".',
    'Both now say Sale Price, so the email a teammate opens matches the preview you checked.',
    'No amount changed. Only the one column name in the sent email.',
  ],
}

export default note
