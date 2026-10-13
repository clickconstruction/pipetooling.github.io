import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5465',
  date: '2026-10-13',
  title: 'Messages: the groundwork for sending a job’s files with an email, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules for the files on an email are written: each up to 10 MB, together up to 20 MB, and a paper the app draws goes as its page in their portal.',
    'Reading a Drive file and making our link to it now live in one place, so the email can use them.',
    'Nothing on screen changes yet.',
  ],
}

export default note
