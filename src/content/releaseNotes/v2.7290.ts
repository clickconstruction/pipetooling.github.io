import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7290',
  date: '2026-11-14',
  title: 'The dev seat stops carrying the texting kernel',
  kind: 'infra',
  highlights: [
    'Nothing on a screen changes. The texts switch asked the texting kernel for one word list, why a text goes, and the dev seat was sent up with the whole kernel and the Quo events behind it for that.',
    'The word list has a file of its own now, and the dev seat is sent up at 3.82 MB where it was 3.91 MB. Texting itself reads the same list from the same place.',
  ],
}

export default note
