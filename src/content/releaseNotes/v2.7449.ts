import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7449',
  date: '2026-11-16',
  title: 'Lien desk: an approved affidavit moves to Held when a fact stops it',
  kind: 'fix',
  highlights: [
    'An affidavit approved before a fact came to stop it no longer sits in Ready to file. It moves to Held, and its row names what is missing, like the homestead answer or a private owner.',
    'Its To do row, its chip on the Board and its header ask the one question, where they read File the affidavit.',
    'Answer the question and the paper goes back to Ready to file by itself. The leader’s approval stands, so he is not asked again.',
    'A paper held this way is still left out of Print for notarization, with its reason on the help sheet.',
  ],
}

export default note
