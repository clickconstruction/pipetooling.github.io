import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2057',
  date: '2026-08-22',
  kind: 'fix',
  title: 'Editing a checklist task now updates its occurrences',
  highlights: [
    'Change a repeating task’s days and the calendar actually changes — future occurrences move to the new days (past ones, completed ones, and any with notes stay put).',
    'Reschedule a one-off and its occurrence moves to the new date, keeping its notes.',
    'Reassign a task and every open occurrence lands on the new person’s Today list immediately — not just future ones.',
    'Part 3 of the checklist scheduling overhaul.',
  ],
}

export default note
