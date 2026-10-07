import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4806',
  date: '2026-10-07',
  title: 'Lien desk: the stop window says where you are and what blocks it',
  kind: 'feature',
  highlights: [
    'The window a stop opens now ends with the path: a row of dots, one per stop, this preview ringed in blue. Press the dots and the whole path unfolds above the footer, with today marked. Press again to fold it. The choice is remembered.',
    'When the stop cannot go, the footer turns amber and says why in two sentences: Don’t send yet, then the one thing to do first, with the gate’s own door beside it. A stop that can go keeps the plain footer.',
    'On an affidavit the line reads Don’t file yet. The red mark on the path names what blocks it: owner of record missing, no GC on the job, no month picked.',
    'Counsel’s portal and the Legal desk get the path too. Nothing of theirs is blocked, so they never see a hold line.',
  ],
}

export default note
