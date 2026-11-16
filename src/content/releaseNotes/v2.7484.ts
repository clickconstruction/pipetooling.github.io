import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7484',
  date: '2026-11-16',
  title: 'Stickers: a sticker is reserved, never blank',
  kind: 'feature',
  highlights: [
    'Print blank stickers is now Print future stickers, on the Materials page and on a job’s page. Nothing about what it does has changed.',
    'The window says what the press holds: each sticker gets its own link and its name, kept for a box you say later.',
    'The press reads Print 109 future stickers, G92 to G200. Once the run is made, the window says the stickers are reserved.',
    'A reserved sticker scanned before it is on a box says so, and asks you to sign in to say which box it is on.',
  ],
}

export default note
