import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2121',
  date: '2026-08-22',
  kind: 'fix',
  title: 'Roadmap task titles wrap while you edit them',
  highlights: [
    'Renaming a task from the Roadmap task card now wraps long titles onto new lines as you type, instead of scrolling the text off the right edge.',
    'Enter still saves and Escape still cancels — nothing else about the card changed.',
  ],
}

export default note
