import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5109',
  date: '2026-10-09',
  title: 'Pipeline: three parts of each row stand on their own',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, three parts of each Pipeline row now live in their own files. These are the icon stack, the crew and dates lines, and the footer under the job.',
    'Nothing changes on screen. Every button, line and chip works as before.',
    'New tests cover each part: the doors each role gets, the Next and Ends lines, the bill line, the man hours, and the invoice chips.',
  ],
}

export default note
