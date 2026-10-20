import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5132',
  date: '2026-10-10',
  title: 'Bids: History offers no Undo on a change no person made',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'],
  highlights: [
    'A change in a bid’s History that no person made, which the line names the app, no longer offers Undo.',
    'Its line says so instead. A robot’s paste still has its Undo.',
  ],
}

export default note
