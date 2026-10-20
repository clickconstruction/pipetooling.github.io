import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5399',
  date: '2026-10-12',
  title: 'Messages: the app’s own emails in a person’s thread, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'An email a person sent from the app reads as theirs. One the app sent by itself reads as the app.',
    'The app’s emails in a row fold into one line, like 3 emails, Oct 8 to Oct 10. A press opens them in place.',
    'Under an email go the address it came from, when it was opened and when its bill was paid, whenever those are known.',
    'Nothing on screen changes yet.',
  ],
}

export default note
