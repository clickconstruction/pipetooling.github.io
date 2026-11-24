import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8437',
  date: '2026-11-24',
  title: 'Document builder: a row says how many times a send went',
  kind: 'fix',
  highlights: [
    'A sheet or a builder sent more than once now reads Sent 2 times, last Nov 23 to Dana Whitlock on its row.',
    'Send it again on the day of the first send used to change nothing you could see. The row read Sent with the same day.',
    'A send that went once reads as it did.',
  ],
}

export default note
