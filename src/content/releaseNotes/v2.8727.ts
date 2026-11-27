import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8727',
  date: '2026-11-27',
  title: 'HR files: the case items and the correction links take no write but through their doors',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'A signed-in teammate who is not a dev could ask the database whether a person’s case held Item 7, and tell yes from no by how it refused. Nothing was read or written, and no item’s words were shown.',
    'The database now refuses any write sent straight at the case items, in the same words whatever it names. The HR tab and the dev seat write through their one door, as before.',
    'The correction links took a question of the same kind, with no sign-in at all. They are closed the same way: nobody without a sign-in holds anything on them, and a signed-in teammate may only read.',
    'Since v2.8730 the HR tab writes a link through its door too, so nothing on the screen changes.',
  ],
}

export default note
