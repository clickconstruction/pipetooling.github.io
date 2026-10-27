import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5919',
  date: '2026-10-26',
  title: 'An error line says what it means, and links to a guide',
  kind: 'feature',
  highlights: [
    'Error lines with a Retry now carry What this means after the reason. One press opens a card under the line: what happened, what was saved and what to do.',
    'The card links to a guide for that kind of error, which opens in a new tab so the error and anything you typed stay on the screen.',
    'Four new guides answer them: No connection, not having access, the server’s words on a failed save, and an app that hangs or a dead link.',
  ],
}

export default note
