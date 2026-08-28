import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2450',
  date: '2026-08-28',
  title: 'Your password is no longer kept on the device',
  kind: 'fix',
  highlights: [
    'The sign-in page used to remember your actual password on the computer to pre-fill it next time. It no longer does — and it cleans up what was saved the next time you visit the sign-in page.',
    'Let your browser offer to save the password instead: that copy is encrypted and protected by your computer\'s own lock.',
    'Your email is still remembered, so signing in is one field and Enter.',
  ],
}

export default note
