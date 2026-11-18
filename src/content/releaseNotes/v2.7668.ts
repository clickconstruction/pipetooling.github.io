import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7668',
  date: '2026-11-17',
  title: 'Tell the dev: a went wrong note reaches the dev at once',
  kind: 'feature',
  highlights: [
    'A Something went wrong note now pushes the dev straight away, within their own notification hours.',
    'The push names the page the note was written on.',
    'I want and This page is confusing notes still wait in the inbox for the day’s read, so they interrupt nobody.',
  ],
}

export default note
