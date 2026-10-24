import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5823',
  date: '2026-10-24',
  title: 'Quickfill: the Customers line leaves texts to the Texts station',
  kind: 'fix',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'On Quickfill, Needs you’s Customers line no longer counts a customer whose waiting message is a text. The Texts station holds every text waiting on a reply, so each text counts once in the round’s left with work.',
    'The Customers line on Quickfill still counts customers who wrote an email, called, left a voicemail or wrote on their page, what we owe them, and senders to sort. The Dashboard’s line is unchanged.',
  ],
}

export default note
