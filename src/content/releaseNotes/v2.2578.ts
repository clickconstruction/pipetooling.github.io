import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2578',
  date: '2026-09-01',
  title: 'Cleaner Click logo on Stripe invoices',
  kind: 'fix',
  highlights: [
    'The icon customers see on Stripe invoice and checkout pages no longer shows as a clipped mark in a white circle — it now sits on the same yellow as the header, so only the hand and wrench show.',
    'The icon file also lives in the app repo now, so it can be re-uploaded or tweaked without rebuilding it from scratch.',
  ],
}

export default note
