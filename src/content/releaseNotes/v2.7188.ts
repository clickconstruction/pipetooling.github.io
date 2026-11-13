import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7188',
  date: '2026-11-13',
  title: 'Phone sheets stay on screen when the keyboard comes up',
  kind: 'fix',
  highlights: [
    'On an iPhone, typing a place\'s name in Where is it? used to push the sheet\'s title and Cancel off the top of the screen. The whole sheet now stays in view, with the name and Use this place above the keyboard.',
    'The sheets inside a Messages thread and the job picker on the Dispatch schedule follow the keyboard the same way.',
  ],
}

export default note
