import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5460',
  date: '2026-10-13',
  title: 'Settings → Flows: turn on the reminders the app sends itself',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A step whose reminder the app sends shows a switch called The app sends this reminder. The owner or a dev turns it on.',
    'Beside the switch are the words the app would text, sent from the company number at 9 AM.',
    'Every step starts off, and the switch saves the moment you press it.',
    'A line above the flow says what the last morning run sent and why it kept any back.',
  ],
}

export default note
