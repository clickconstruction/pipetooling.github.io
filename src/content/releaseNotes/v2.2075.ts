import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2075',
  date: '2026-08-22',
  kind: 'feature',
  title: 'Edit checklist item: the same clear scheduling as Add',
  highlights: [
    'The edit form now matches the add form: a plain When choice (Today · On a date · Repeats), tap-able day pills, and the live green sentence stating exactly what Save will do.',
    'A note under the sentence says what an edit really does: upcoming occurrences reshape, completed ones and their notes stay put.',
    'The wall of assignee checkboxes became the same searchable people picker as Add, and notifications are one line.',
    'Tap "Today" on an overdue one-off to bring it to today.',
  ],
}

export default note
