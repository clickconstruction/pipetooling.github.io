import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5485',
  date: '2026-10-13',
  title: 'Messages: sort everyone in New one at a time',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When two or more people wait in New, Sort all on its header opens a desk that shows one person at a time.',
    'Each card has the line and the same sort presses as the thread. A press brings the next person up.',
    'Skip for now comes back to someone after the rest. The desk says All sorted when New is empty.',
  ],
}

export default note
