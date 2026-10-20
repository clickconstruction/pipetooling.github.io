import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5268',
  date: '2026-10-12',
  title: 'Messages: a text sent from Quo’s own app lands in the thread too, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A text the team sends from Quo’s phone app will show in the person’s thread, under the name of who sent it.',
    'A text that did not arrive says so in the thread.',
    'Nothing on screen changes yet.',
  ],
}

export default note
