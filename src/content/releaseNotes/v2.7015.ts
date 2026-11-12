import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7015',
  date: '2026-11-12',
  title: 'A teammate’s desk reads cleanly at every width',
  kind: 'fix',
  highlights: [
    'On a teammate’s desk, a row’s buttons move under its value when they do not fit beside it. The Sign-in row reads “signed in 6d ago” on one line, with its three buttons below.',
    'On a phone, no value runs under a menu or a button any more, and none breaks one word a line.',
    'The amber notes at the top keep their words on the left and their buttons together, and they use the panel’s whole width.',
    'The bio card’s first line lines up with the rest of the card.',
  ],
}

export default note
