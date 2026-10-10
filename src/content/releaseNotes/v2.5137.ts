import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5137',
  date: '2026-10-09',
  title: 'GC projects: the record behind the office’s reminders, ready and switched off',
  kind: 'infra',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'The app can now work out the office’s three GC reminders: bill day in two days, a pay application still with the architect after 3 days, and after 5.',
    'Each reminder goes once, and only for pay applications sent after the owner turns them on. Nothing is sent yet: the emails and the switch in Settings come next.',
  ],
}

export default note
