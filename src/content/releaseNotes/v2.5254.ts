import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5254',
  date: '2026-10-12',
  title: 'Messages: the facts that finish each step of a flow',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Groundwork for the flows in Messages. Nothing changes on screen yet.',
    'The app now holds one list of the facts that finish a step, with where each one is read.',
    'It also holds the customer, trade partner and architect flows as the prototype draws them.',
  ],
}

export default note
