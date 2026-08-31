import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2524',
  date: '2026-08-31',
  title: 'Locked out? The sign-in page can email you a one-time link',
  kind: 'feature',
  highlights: [
    'After two failed password attempts, the sign-in page now offers to email you a one-time sign-in link — tap it and you\'re in, no password needed.',
    'Open the link on the device you want to use; it signs in whichever browser opens it.',
    'The link only works for existing accounts — a mistyped email gets a clear "no account found" message instead of a dead end.',
  ],
}

export default note
