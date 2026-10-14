import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5442',
  date: '2026-10-13',
  title: 'Messages: the morning reminders the app sends itself, written and switched off',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Each morning at 9 the app can text a reminder for a step that waits on someone, from the company number, the way Follow up shows it as due.',
    'Every step is off until the owner turns one on, so nothing sends yet. Customers wait until the run can read their page.',
    'Each morning leaves a summary of what went and what was kept back and why.',
  ],
}

export default note
