import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2096',
  date: '2026-08-22',
  title: 'Task reminders for everyone — with email backup',
  kind: 'feature',
  highlights: [
    'The Remind section on checklist tasks is now open to everyone who creates tasks (it was dev-only), with one-tap times: Morning 7:00, Midday 12:00, End of day 4:00, or custom.',
    'Reminders always land: people without phone alerts set up get an email instead, and the modal shows how each assignee will be reached.',
    'Two new options — "Also remind the day before it\'s due" and "Still not done after N days? Remind me too," which starts copying you once a task sits overdue that long.',
    'A green sentence restates the whole plan in plain words, e.g. "Reminds Michael A & Bryan every day at 7:00 AM until it\'s done — and you after 3 days."',
  ],
}

export default note
