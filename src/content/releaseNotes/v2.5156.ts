import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5156',
  date: '2026-10-10',
  title: 'GC mode: the office can read a change order’s days, never its money, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A change order’s days, status and words can now be read by the office without its cost, price or percent done. The schedule will read them next.',
    'Nobody can change a change order this way. Changing one stays on Bill the customer.',
  ],
}

export default note
