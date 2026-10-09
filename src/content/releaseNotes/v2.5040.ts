import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5040',
  date: '2026-10-09',
  title: 'Security: a signed-out visitor can run only the hazmat notice lookup',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Someone who is not signed in can no longer call the database functions directly. The hazmat notice page keeps the one lookup it needs. Every other public page already works through the server, so nothing changes for customers.',
    'New database functions start closed to signed-out visitors. A function a public page needs is opened by name.',
    'The cost and HR agent logins keep working. They now hold the checks their reads and writes use.',
  ],
}

export default note
