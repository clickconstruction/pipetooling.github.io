import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2448',
  date: '2026-08-28',
  title: 'Enter signs you in',
  kind: 'fix',
  highlights: [
    'Pressing Enter in the email or password field now signs you in — no more reaching for the Sign in button.',
    'The app handles the keystroke itself, so browser password managers and autofill popups can no longer swallow it.',
  ],
}

export default note
