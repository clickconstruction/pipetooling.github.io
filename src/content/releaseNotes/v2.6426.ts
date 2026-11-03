import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6426',
  date: '2026-11-02',
  title: "The dev seat keeps a piece of evidence on a person's HR file",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    "A dev's agent plans a piece of evidence — the day it is about, a title, a memo and its files — and applies it: the record lands on the person's Evidence tab under the same rules as the window.",
    'The files go where the window puts them and then into the People folder in Drive. If Drive cannot take them yet, the record still stands and the sweep tries again.',
    'Plan first, read the plan, then apply quoting its hash. A correction is a new record, never an edit.',
  ],
}

export default note
