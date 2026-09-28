import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3933',
  date: '2026-09-27',
  title: 'People: who may open App Activity is checked in one place',
  kind: 'fix',
  highlights: [
    'The People page asked for your role a second time just to decide whether to show App Activity. It reads it once now, and the rule has tests.',
    'Nothing on screen changes.',
  ],
}

export default note
