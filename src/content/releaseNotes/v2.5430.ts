import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5430',
  date: '2026-10-12',
  title: 'Messages: put a customer’s message on their estimate as a line',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Press a customer’s message on one of their Pipeline jobs, then Line on the estimate.',
    'The line goes on the job’s open draft at $0, or starts a new estimate. The money team prices it and sends it.',
    'The message then shows which estimate it is on, and it is never put on one twice.',
  ],
}

export default note
