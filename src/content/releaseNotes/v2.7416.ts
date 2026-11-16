import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7416',
  date: '2026-11-15',
  title: 'Painted maps: a shared map opens only for a reader who gave a name',
  kind: 'infra',
  highlights: [
    'The server now refuses a shared map, and its photos, to a phone that gave no name.',
    'A page left open from before the name step says it is out of date and asks to be reloaded.',
    'Nothing changes for a reader who gave their name.',
  ],
}

export default note
