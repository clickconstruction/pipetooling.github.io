import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2026',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Portal statements carry a QR code back to their account',
  highlights: [
    'The bottom of every portal statement now shows a "Your account, any time" card — the customer\'s short address plus a QR code.',
    'Printed or screenshotted statements always carry a scannable way back to open bills, online payment, and the request forms.',
    'The card appears once a customer has a portal address; scoped GC-only / own-jobs-only links stay unadorned.',
  ],
}

export default note
