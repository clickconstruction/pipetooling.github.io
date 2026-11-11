import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6966',
  date: '2026-11-11',
  title: 'A text document on a person’s matter is closed to everyone but devs',
  kind: 'fix',
  highlights: [
    'A matter that stands on a person is private to devs. Its text documents and their earlier versions were kept in a place that missed that rule, and now carry it.',
    'No screen ever showed these documents to anyone else. Only test documents were there when the gap was found.',
    'Nothing changes for an account’s matter on the Legal desk. The office reads and edits its text documents as before.',
  ],
}

export default note
