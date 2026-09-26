import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3842',
  date: '2026-09-25',
  title: 'Checklist: a repeating task counts from the day you finish it',
  kind: 'fix',
  highlights: [
    'A task set to repeat “N days after it’s completed” counted the N days from the day it was due, not the day it was done — so a task finished 5 days late came back 5 days early, sometimes already overdue.',
    'It now counts from the day you check it off, as the setting says: change the oil 30 days after each time really means 30 days after this time. Finishing a whole backlog of missed copies at once also counts from today.',
  ],
}

export default note
