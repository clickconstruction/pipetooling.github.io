import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5272',
  date: '2026-10-12',
  title: 'Messages: a change order started from a customer’s message',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Groundwork for Messages. Nothing changes on screen yet.',
    'A customer’s message can start a change order on the job it is tied to. The customer contact signs it.',
    'Anyone in the office can draft it. Only the money team can send it.',
    'The message shows which change order it became, and the change order points back to it.',
  ],
}

export default note
