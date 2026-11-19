import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7823',
  date: '2026-11-18',
  title: 'Tasks: an assistant can close a task that no longer applies',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now close a one-time task without the work done, as No longer applies does on the task’s card.',
    'The reason is kept in the task’s thread, and the task shows in History as closed, no longer applying.',
    'Whoever gave the task is told, and can reopen it to put it back.',
    'It is never recorded as done by the person the task was for.',
  ],
}

export default note
