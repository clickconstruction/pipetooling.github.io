import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8727',
  date: '2026-11-27',
  title: 'HR files: a case’s items take no write but through their door',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'A signed-in teammate who is not a dev could ask the database whether a person’s case held Item 7, and tell yes from no by how it refused. Nothing was read or written, and no item’s words were shown.',
    'The database now refuses any write sent straight at the case items, in the same words whatever it names. The HR tab and the dev seat write through their one door, as before.',
    'The correction links took a question of the same kind with no sign-in at all. Nobody without a sign-in holds anything on them now.',
    'Still open: a signed-in teammate who is not a dev can put that question to the correction links. Closing it waits on one choice.',
  ],
}

export default note
