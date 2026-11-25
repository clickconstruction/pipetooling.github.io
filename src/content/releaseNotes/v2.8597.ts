import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8597',
  date: '2026-11-25',
  title: 'Materials on site: a job reads as empty only once its boxes are read',
  kind: 'fix',
  highlights: [
    'The On site list said No containers on this site yet, with Add a container, while the boxes were still loading. It said the same after a read failed.',
    'It now says so only once the read is in. While it loads, the loading line stands alone. After a failed read, the retry panel stands alone.',
    'The same mend is on a job’s On site section of the Materials page.',
  ],
}

export default note
