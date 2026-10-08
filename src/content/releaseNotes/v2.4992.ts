import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4992',
  date: '2026-10-08',
  title: 'Dispatch: the add-block window moved to its own file',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the window that adds a block to a person’s day on the Dispatch board moved out of the page into its own file.',
    'Nothing changes on screen. It still opens on the first free time in the day, lists the day’s blocks in order and saves the same way.',
    'New tests cover how it opens, saves, shows a refused save and shuts.',
  ],
}

export default note
