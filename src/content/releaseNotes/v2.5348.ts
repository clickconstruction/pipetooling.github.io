import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5348',
  date: '2026-10-12',
  title: 'The code that keeps a copy of each sent email passes its type check again',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The server code that files a copy of every email we send is checked cleanly by the server’s own type checker.',
    'What is sent, what is kept and how it is filed do not change.',
  ],
}

export default note
