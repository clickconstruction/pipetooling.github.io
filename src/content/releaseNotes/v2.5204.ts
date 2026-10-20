import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5204',
  date: '2026-10-10',
  title: 'GC mode: a set of plans always says which sheets it changed, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Each set of plans on a GC project now carries the sheets it changed, ready for the ring’s stale quotes.',
    'Nothing on screen changes yet.',
  ],
}

export default note
