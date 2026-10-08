import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4936',
  date: '2026-10-08',
  title: 'GC mode: one sender for every email to a trade partner',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'GC mode can now email a trade partner company from one place, for an invitation, a reminder, new plans, an answer and the rest.',
    'Each email goes to whoever at the company gets that kind of email, greets them by first name and carries the company’s portal link.',
    'A message goes out once. Each one is kept as a sent copy without the link, and shows in the company’s portal under its messages.',
    'Only a dev’s press sends while GC mode is built. The Ask window, a new set of plans and the questions window switch to it next.',
  ],
}

export default note
