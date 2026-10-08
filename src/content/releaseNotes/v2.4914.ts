import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4914',
  date: '2026-10-07',
  title: 'People → Review: a person’s panel is its own piece',
  kind: 'fix',
  highlights: [
    'The panel that opens under the Team Summary when you click a name is now its own piece, with tests. Nothing on the screen changes, and a collapsed Jobs Worked still stays collapsed when you click another name.',
  ],
}

export default note
