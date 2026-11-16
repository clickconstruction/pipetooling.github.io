import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7413',
  date: '2026-11-15',
  title: 'Painted maps: the server can keep who opened a map’s link',
  kind: 'infra',
  highlights: [
    'The second step toward a shared map that asks a signed-out reader for their name.',
    'The server can now keep the name, the device and, when the reader chooses to show it, where they were.',
    'Nothing on a screen changes yet. The page that asks comes next.',
  ],
}

export default note
