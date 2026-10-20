import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5463',
  date: '2026-10-13',
  title: 'Two changes that each add a server function no longer block each other in the merge queue',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The list the developer tools keep of every table, database function and server function now holds one name per line.',
    'Two changes that each add a name touch different lines, so the merge queue no longer drops the second one.',
    'Nothing in the list changes, only how it is laid out.',
  ],
}

export default note
