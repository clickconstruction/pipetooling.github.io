import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5270',
  date: '2026-10-12',
  title: 'Messages: the reminders the app sends by itself each morning',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Groundwork for the flows in Messages. Nothing sends yet.',
    'Each morning the app can work out which reminders to text by itself. Every step stays off until the owner turns it on.',
    'It skips a number that sent STOP, anyone snoozed on Follow up, and anyone reminded within the step’s days.',
    'Each text uses the step’s own line, and the thread notes that the app sent it.',
  ],
}

export default note
