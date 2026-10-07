import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4759',
  date: '2026-10-07',
  title: 'Pipeline on a phone: a link to a stage lands on that stage',
  kind: 'fix',
  highlights: [
    'A link that names a Pipeline stage, like the Dashboard\'s In collections tile, now picks that stage on the phone board.',
    'Before, the phone board stayed on whichever earlier stage was already open and the stage had to be chosen on the strip.',
  ],
}

export default note
