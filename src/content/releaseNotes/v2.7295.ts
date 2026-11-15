import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7295',
  date: '2026-11-14',
  title: 'A Dashboard test no longer fails every evening',
  kind: 'fix',
  highlights: [
    'A check on the late lien notice card failed every evening after 6 PM Central. It held every change waiting to go live.',
    'The check now counts days from the same today the card does. Nothing on the Dashboard changed.',
  ],
}

export default note
