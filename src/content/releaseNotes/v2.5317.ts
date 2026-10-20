import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5317',
  date: '2026-10-12',
  title: 'Contracts and clauses: the approvers get a push and an email',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When you send a clause change for approval, each controller and dev gets a push on their phone and an email with the change.',
    'The message after you save says who it reached, and how.',
    'When a change is approved or declined, the person who made it gets an email, with the why on a decline.',
  ],
}

export default note
