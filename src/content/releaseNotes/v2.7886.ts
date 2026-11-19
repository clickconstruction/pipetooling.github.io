import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7886',
  date: '2026-11-18',
  title: 'Dev seat: a trip’s number in the read',
  kind: 'feature',
  highlights: [
    'Every trip has a short number on its site, like Trip 5. The dev seat’s read of a site’s trips now gives that number with each trip.',
    'A planned change says which trip it is by number, and a saved trip’s reply says the number it was given.',
  ],
}

export default note
