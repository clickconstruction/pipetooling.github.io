import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8500',
  date: '2026-11-24',
  title: 'The email that asks someone to sign now fits a phone',
  kind: 'fix',
  highlights: [
    'The email with a paper to sign was wider than a phone, so its top and the paper’s name ran off the right edge.',
    'The cause was the signing link written out under the button. It is one long run with no space, and it did not wrap.',
    'The link now wraps inside the line. The link itself, the button and the words are the same.',
    'A reminder to sign uses the same email, so it fits too.',
  ],
}

export default note
