import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5174',
  date: '2026-10-10',
  title: 'GC mode: our contract emailed to the customer, to sign in their portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Sending our contract can now email it, with the file attached and a link to their portal to sign it.',
    'The first email makes their portal link when they have none.',
    'An email that did not go reads Not emailed on the row, and Email it now sends it again without a second send.',
    'The email goes only with the file as it was sent, and never with a card offer.',
  ],
}

export default note
