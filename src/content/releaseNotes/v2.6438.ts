import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6438',
  date: '2026-11-03',
  title: 'Messages: the reply box’s behind-the-scenes checks read no live data',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Fourteen behind-the-scenes checks of the reply box read a customer’s bills and estimates from the live database while they ran, a read a build server could not answer. Each now reads none. Nothing changed in the app.',
  ],
}

export default note
