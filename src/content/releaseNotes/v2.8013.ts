import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8013',
  date: '2026-11-19',
  title: 'Papers: reminders by email for a staff or sub paper',
  kind: 'feature',
  highlights: [
    'A staff or sub paper that waits on a signature can now be reminded by email: up to 3 reminders, 3 days apart.',
    'It starts switched off. The owner turns it on in Settings, People & teams, and only papers sent after that are reminded.',
    'A waiting paper says how many reminders went and when the next one is. Turn reminders off for one paper on its line.',
    'Each reminder carries a new signing link, and the link before it stops working. The email says so.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
