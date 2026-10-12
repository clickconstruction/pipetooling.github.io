import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5280',
  date: '2026-10-12',
  title: 'Messages: the database for a change order started from a message',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Groundwork for Messages. Nothing changes on screen yet.',
    'Anyone in the office can draft a change order from a customer’s message. The office never sees its cost or price.',
    'The money team prices it and sends it to sign. Each send is kept with its file.',
  ],
}

export default note
