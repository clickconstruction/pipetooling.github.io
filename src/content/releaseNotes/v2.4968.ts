import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4968',
  date: '2026-10-08',
  title: 'People: the Hours grid’s typed-hours editor moved to its own files',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the editor that opens when you type hours into a day on the Hours grid moved out of the People page into its own files.',
    'Nothing changes on screen. Typing hours still opens the day’s sessions scaled to your total, or one new session when the day is empty.',
    'New tests cover how it opens, how its save updates the grid, and its edits.',
  ],
}

export default note
