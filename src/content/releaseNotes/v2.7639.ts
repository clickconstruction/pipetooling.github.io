import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7639',
  date: '2026-11-17',
  title: 'Filed liens: the mail sheet’s short columns fit their words',
  kind: 'fix',
  highlights: [
    'On the mail sheet that prints in front of a filed lien’s copies, the number, Copy to and Mail by columns are now only as wide as their longest text.',
    'Original contractor stays on one line.',
    'The room they gave up goes to the name and address on the envelope, so fewer addresses wrap.',
  ],
}

export default note
