import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8739',
  date: '2026-11-27',
  title: 'HR files: the correction links take no write but through the HR door',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'A signed-in teammate who is not a dev could ask the database where an entry or a record stood on an HR file, by sending a link straight at the links table and reading how it refused. Nothing was read or written.',
    'The database now refuses any write sent straight at the correction links, in the same words whatever it names.',
    'Nothing changes on People → HR. Since v2.8730 the tab writes a link, and takes one off, through the same dev-only door the dev seat uses.',
    'This is the last of three steps. The case items were closed the same way in v2.8727.',
  ],
}

export default note
