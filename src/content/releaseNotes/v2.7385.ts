import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7385',
  date: '2026-11-15',
  title: 'Job notes: the database can now hold a tag for a teammate',
  kind: 'infra',
  highlights: [
    'A job note can now carry a tag for a teammate, kept as its own record. Nothing on screen has changed yet.',
    'The office and a job’s own crew can be tagged on it. Subs and estimators cannot, in this first version.',
    'A tag waits until the tagged person answers on the job or says no reply is needed. Reading it clears nothing.',
    'The next update adds the list of names to the note box on a Pipeline row.',
  ],
}

export default note
