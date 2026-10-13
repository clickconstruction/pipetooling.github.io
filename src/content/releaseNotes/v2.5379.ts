import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5379',
  date: '2026-10-13',
  title: 'Lien desk: a home for every envelope sent certified from the app, behind the scenes (Docsmit train, PR 2, migration 20261013120000)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The database gains one table for every envelope the company sends certified through a mail service, whatever sent it. The Lien desk’s notices will be the first to use it.',
    'Each row keeps the address as it was mailed, the USPS number, the day USPS accepted it, the delivery and who signed, and a running timeline of everything the mail service reported.',
    'The office reads and updates a piece the way it does a lien filing. Nothing signed in can delete one.',
    'Nothing changes on screen yet. The functions that talk to the mail service come next.',
  ],
}

export default note
