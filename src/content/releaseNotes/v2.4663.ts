import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4663',
  date: '2026-10-06',
  title: 'Submittals: a draft you have not shared is "Not sent yet", not "Waiting on the GC"',
  kind: 'fix',
  highlights: [
    'On Bids → Submittals, the procurement log of a draft nobody has shared used to say its parts were waiting on the GC. The GC had never seen them. The first step now reads Not sent yet, with Share Rev 4 first under it, and the Procure pill says the same.',
    'The Next line says it plainly: Share Rev 4 first. 11 parts have not been sent.',
    'In To order, those fixtures sit under Not sent to the GC yet instead of Waiting on their answer, with no Their answer… link, since there is no answer to enter. Once you share the revision, the words go back to Waiting on the GC.',
  ],
}

export default note
