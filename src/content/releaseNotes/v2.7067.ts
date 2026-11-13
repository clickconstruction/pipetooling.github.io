import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7067',
  date: '2026-11-12',
  title: 'Tasks: add a place to a task while you stand at it',
  kind: 'feature',
  highlights: [
    'A task with no place now has one quiet line when you open it: Standing at this task? Add its place.',
    'Your phone looks up where you are, shows how sure it is, and you name the place before it is saved.',
    'The next person who gets the task sees the place and can get directions.',
    'A task that already has a place keeps it. If its place is wrong, say so in a note.',
  ],
}

export default note
