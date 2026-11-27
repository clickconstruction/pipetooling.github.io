import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8762',
  date: '2026-11-27',
  title: 'New task opens every time, and a task being typed no longer vanishes',
  kind: 'fix',
  highlights: [
    'After a task was sent, + New task could stop opening until the page was reloaded. Once, a window vanished while a task was being typed.',
    'The window checked who you are each time it opened, and drew nothing if that check failed. It now uses what the app already knows about you.',
    'It also opens at once, where it used to wait a moment.',
  ],
}

export default note
