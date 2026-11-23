import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8398',
  date: '2026-11-23',
  title: 'Permits: the lot lookup passes its type check',
  kind: 'infra',
  highlights: [
    'Behind the scenes only. The permit lot lookup now names its database link the way the other lookups do, so its type check passes. Nothing it does changes.',
  ],
}

export default note
