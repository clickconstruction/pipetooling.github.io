import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5524',
  date: '2026-10-14',
  title: 'Messages: a test keeps the sort card to one in a thread',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A person waiting in New shows one sort card in their thread, however often the window redraws.',
    'A new test holds it there. The card had stacked up on prod until v2.5516 gave each part of the thread its own key.',
  ],
}

export default note
