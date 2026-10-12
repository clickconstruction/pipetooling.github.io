import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5264',
  date: '2026-10-12',
  title: 'Messages: reading contacts and their messages from the new tables, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Contacts and their messages now read from the new tables into the shapes the Messages pages will draw.',
    'Each person shows the name and company their record holds, with their numbers before their addresses.',
    'A line from someone shows their name when nothing else says who wrote it.',
    'Nothing on screen changes yet.',
  ],
}

export default note
