import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5057',
  date: '2026-10-09',
  title: 'Help: “share a customer their portal” starts with what to do first',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The guide now opens with what to do first: the portal is a private page with their statement and Pay online buttons, and you make the link from the globe next to their name.',
    'What the customer sees on their portal, and the switch that shows an owner the bills their GC pays, are now guides of their own.',
    'Nothing in the app changes, and no sentence was cut. Each part moved whole.',
  ],
}

export default note
