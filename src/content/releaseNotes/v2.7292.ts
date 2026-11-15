import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7292',
  date: '2026-11-14',
  title: 'The dev seat stops carrying the contract form schema and the GC customer email kernel',
  kind: 'infra',
  highlights: [
    'Nothing on a screen changes. The hours statement’s form asked the contract form schema for the shape of a filled form, and a mail’s signer asked the GC customer email kernel for the GC’s name; the dev seat was sent up with both files for those two lines.',
    'The shape and the name have files of their own now, and the dev seat is sent up at 3.70 MB where it was 3.75 MB. Signing, the schema and the GC emails read the same two from the same place.',
  ],
}

export default note
