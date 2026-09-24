import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3794',
  date: '2026-09-23',
  title: 'The “signed” email subject loses its dash',
  kind: 'fix',
  highlights: [
    'The email the office gets when an estimate or proposal is signed now reads “Dana Ruiz signed $4,250 · Second-floor rough-in” — no dash between the name and the amount.',
  ],
}

export default note
