import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5475',
  date: '2026-10-13',
  title: 'Lien desk: a price the mail service will not quote no longer holds an envelope, behind the scenes (Docsmit train, fix)',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The price check now asks the mail service the way its documentation requires, and reads the answer it actually gives.',
    'When the service will not quote a price, the envelope still prepares and reads as not priced yet. Sending is the real word on credit: it stops with the shortfall when the balance is short.',
  ],
}

export default note
