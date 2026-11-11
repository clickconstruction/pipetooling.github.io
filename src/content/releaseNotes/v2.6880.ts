import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6880',
  date: '2026-11-10',
  title: 'An agent reads the words of a file that came by mail',
  kind: 'feature',
  highlights: [
    'An agent on the dev seat could already fetch a file off a mail, but only as raw bytes, a piece at a time. Reading a supplier’s PDF that way took four long replies before a word of it was read.',
    'It can now ask for the file’s words instead: the text of a PDF, a text file or a saved email, in pieces short enough to read.',
    'A scan has no words to hand back, and the seat says so plainly and names the two ways on: read the bytes, or file it on its job.',
    'Nothing changes for anyone in the app. The read is still read-only, and every read is logged.',
  ],
}

export default note
