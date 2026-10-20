import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5470',
  date: '2026-10-13',
  title: 'Messages: Who is this? lists first the people who fit the inbox a message came to',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A message to our bids inbox lists trade partners and supply houses first in Who is this?.',
    'A message to the company number lists customers first.',
    'Behind the scenes, a reply knows which inbox and number it will go from, ready for when the two inboxes switch on.',
  ],
}

export default note
