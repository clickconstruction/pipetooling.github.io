import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6721',
  date: '2026-11-08',
  title: 'The dev seat indexes the files already on a person’s record',
  kind: 'feature',
  highlights: [
    'A case filed before the index reached the HR file has its files read on one ask: the seat’s backfill takes a person, lists every file on their record and their matter with which the index has not read yet, and indexes them a few at a time until none are left.',
    'Each call writes what it read before it answers, so a stopped run loses nothing and the next call carries on. A file filed or removed since the plan refuses the apply, so the plan is read again.',
  ],
}

export default note
