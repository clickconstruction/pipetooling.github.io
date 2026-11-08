import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6676',
  date: '2026-11-08',
  title: 'Messages: read an email as the sender laid it out, with Rich text · Plain',
  kind: 'feature',
  highlights: [
    'Open an email in Messages and two chips sit above its words, Rich text and Plain. Rich text reads the email as the sender laid it out: tables, numbered lists and linked words. Plain is the view you had.',
    'Pictures stay off until you press Show pictures, so opening an email tells the sender nothing. Tracking pixels never load. Scripts, forms and the sender’s page styles are taken out.',
    'Every link in the rich view opens in a new tab, as the plain view’s do. Copy, Print and Share still use the plain words.',
    'The app remembers your choice on this device. An email that came in before this release has no chips and reads as plain words.',
  ],
}

export default note
