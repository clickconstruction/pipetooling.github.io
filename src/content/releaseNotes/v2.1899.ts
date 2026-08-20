import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1899',
  date: '2026-08-20',
  title: 'More behind-the-scenes shipping polish',
  kind: 'infra',
  highlights: [
    'Internal tooling now reminds developers to announce what part of the app they are working on, so parallel work streams collide less.',
    'No visible changes in the app.',
  ],
}

export default note
