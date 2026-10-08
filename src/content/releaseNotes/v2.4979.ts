import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4979',
  date: '2026-10-08',
  title: 'Dispatch: the mode banners moved to their own file',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the strips that appear above the Dispatch board while you move, copy or place a block moved out of the page into their own file.',
    'The Choose job bar for adding a job to several cells moved with them.',
    'Nothing changes on screen. Each strip says the same words, and its buttons do the same things.',
    'New tests cover every strip and the bar.',
  ],
}

export default note
