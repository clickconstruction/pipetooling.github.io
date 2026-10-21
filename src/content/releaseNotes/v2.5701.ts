import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5701',
  date: '2026-10-21',
  title: 'Messages: search every message from the top of the page',
  kind: 'feature',
  highlights: [
    'A search box now sits under the pills on the Messages page. Type two letters or more and the lists give way to Lines that match: the messages that hold those words, newest first.',
    'Each row names the person, whose line it is, and the words around the match. Press it to open the thread at that line.',
    'The kind pills narrow the search like the lists. Clear the box to see the lists again.',
  ],
}

export default note
