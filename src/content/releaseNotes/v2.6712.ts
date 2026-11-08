import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6712',
  date: '2026-11-08',
  title: 'A dev’s agent puts a Drive document on an HR file without carrying its text',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A named document on a person’s HR file can now be made from a .md, .txt or Google Doc already in Drive. The agent names the file; the server reads it and writes the document, so a long document costs two small calls instead of its whole text twice.',
    'The plan says what will land: the file, its size, its fingerprint and its first heading. If the file changes in Drive before the apply, nothing is written and the refusal says so.',
    'The document remembers which file it came from and which version of it, so a reader knows it is a copy of a file on the drive.',
    'A PDF or an image is refused with the door that takes it: link it on an evidence record instead.',
  ],
}

export default note
