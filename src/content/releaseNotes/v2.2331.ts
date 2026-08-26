import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2331',
  date: '2026-08-26',
  title: 'Print the portal statement, one job per page',
  kind: 'feature',
  highlights: [
    'A new Print all button at the top of the customer portal statement prints a cover page, then every job on its own page — its bills, every payment received, and the balance recap — then a closing page with the total and the portal QR code.',
    'Every printed page identifies itself (customer · date · Job N of M), so pages can be reviewed one at a time or handed out separately. "Save as PDF" in the print dialog makes it a file.',
    'Pay-online buttons and request forms stay off the paper; check references and the QR code print.',
  ],
}

export default note
