import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5426',
  date: '2026-10-12',
  title: 'Messages: a message remembers the estimate it became a line on, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A customer’s message can now keep the estimate it became a line on.',
    'Several messages can feed one draft estimate, and each keeps its own link.',
    'Nothing on screen changes yet.',
  ],
}

export default note
