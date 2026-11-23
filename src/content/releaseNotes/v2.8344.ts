import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8344',
  date: '2026-11-23',
  title: 'Dashboard: Recent Reports has one heading row, a foot, and an Opened group',
  kind: 'feature',
  highlights: [
    'The Recent Reports heading is one row on every phone. Mark opened, Email reports and View all moved to the bottom of the card.',
    'Mark opened on a report clears it off the list at once, with Undo. Cleared reports wait in an Opened group, where Mark unread brings one back. The Done press is gone, since it could not be undone.',
    'The list refills as you clear it, eight at a time from the last 14 days, and the badge counts every new report. Before, a ninth new report was never shown.',
    'A press anywhere on a report opens it, the day and time read as one value, and a clear list says Nothing new to read.',
  ],
}

export default note
