import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6544',
  date: '2026-11-05',
  title: 'Every evidence file on an HR file carries its hash, so a record and a folder are matched by the same number',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A file staged on an evidence record now keeps the SHA-256 of its bytes as picked. The chip’s tip reads it as its first twelve characters.',
    'The dev seat already digested every file it sends; the record now keeps that number, and the seat’s read of a person’s file carries it back.',
    'A linked file and the files from before this release carry none.',
  ],
}

export default note
