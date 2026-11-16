import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7486',
  date: '2026-11-16',
  title: 'Reserve stickers: the preview no longer reads as a sticker with no link',
  kind: 'fix',
  highlights: [
    'What the stickers will look like now says, right over the strips, that each sticker gets its own link when it prints.',
    'The strips in the preview read XXXX-XXXX where they read 0000-0000. The X’s stand in for the link, and the line says so.',
    'Nothing about the print has changed. Every sticker has always printed with a link of its own.',
  ],
}

export default note
