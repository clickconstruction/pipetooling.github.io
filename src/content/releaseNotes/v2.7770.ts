import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7770',
  date: '2026-11-18',
  title: 'Bill Customer: a test now presses the physical invoice send',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, a new test presses Email the invoice on the Bill Customer window from start to finish, with the email itself stubbed out. Until now no test pressed that button.',
    'It checks every step in order and what the email carries. It also checks what happens when the server refuses, when the amount changed, and when the PDF is too large.',
    'Nothing changes on screen, and the test sends no bill.',
  ],
}

export default note
