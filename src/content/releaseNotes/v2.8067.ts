import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8067',
  date: '2026-11-20',
  title: 'Painted maps: a walk says Precise Location looks off even when the phone’s rough reading is an old one',
  kind: 'fix',
  highlights: [
    'A phone with Precise Location off can hand a walk one rough reading that it worked out minutes ago. The walk threw that reading away and said Finding you for as long as you stood there.',
    'The walk now takes it. After 4 seconds the line says Precise Location looks off, lists the steps to the switch and shows the circle you are somewhere in.',
    'An old reading that is a real spot is still left out, so the line never jumps back to where you were.',
  ],
}

export default note
