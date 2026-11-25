import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8572',
  date: '2026-11-25',
  title: 'Checklist → Manage: deleting a task now says what happened',
  kind: 'fix',
  highlights: [
    'Delete a task from Manage and a line now says Task deleted. Before, the row leaving the list was the only sign.',
    'When the delete fails, the line says the task was not deleted and why. The window stays open so you can try again.',
    'When the task is someone else’s, or already gone, the line says it was not deleted. Before, the window closed and said nothing.',
  ],
}

export default note
