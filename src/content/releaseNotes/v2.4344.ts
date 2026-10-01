import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4344',
  date: '2026-10-01',
  title: 'Change the email someone signs in with',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A person’s desk has Change… on the Email row. The new address is the one they sign in with from then on, and the old one stops working.',
    'Changing an email under Manage accounts… moves their sign-in too. Before, it only changed the address the app showed, so a sign-in email could go nowhere.',
    'Their hours, pay and jobs stay with them. Only the address changes.',
  ],
}

export default note
