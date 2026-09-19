import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3616',
  date: '2026-09-19',
  title: 'Supervision, PR 5: the Team leads list retires — My Team reads the crew you supervised',
  kind: 'feature',
  highlights: [
    'The Team leads modal on People → Users, the Team section on a person\'s desk, and the "assign a leader" step when someone starts are gone. Nobody names leaders and members by hand any more; who supervises whom is read off the schedule and the clock.',
    'My Team on the Dashboard now lists the people you supervised this week. The approve controls stay with a dev, a pay-approved master or the office; a master who is not pay-approved sees the same roster read-only. The per-person "notify me when they clock" bell is gone with the list.',
    'Existing leader links keep working quietly in the background until the table is dropped in a later release; nothing new can be added to them.',
  ],
}

export default note
