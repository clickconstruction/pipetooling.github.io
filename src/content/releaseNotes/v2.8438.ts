import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8438',
  date: '2026-11-24',
  title: 'Customers: removing a contact asks first',
  kind: 'fix',
  highlights: [
    'Remove on a customer’s contact now asks before anything goes. The window names the person, and its button reads Remove with their name.',
    'It says a dev can put the contact back for 90 days from Recently deleted, and that a contact who gets every bill stops getting one.',
    'Keep them closes the window and changes nothing. Remove used to take the contact off at once.',
  ],
}

export default note
