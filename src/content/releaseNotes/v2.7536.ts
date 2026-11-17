import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7536',
  date: '2026-11-16',
  title: 'Checklist: the old-task list is Still open, and red means late',
  kind: 'feature',
  highlights: [
    'The Outstanding list under Today is now Still open. Its red frame and red "need doing" pill are gone.',
    'A task with no due day says when it was given and shows its age in a pill, amber after a week. It no longer reads "due" in red.',
    'Red is kept for a task whose due day has passed, on the list and on the Where my tasks are map.',
    'The list shows three rows and folds the rest behind Show more. A task\'s roadmap tag shows in full.',
  ],
}

export default note
