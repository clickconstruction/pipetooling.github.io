import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8670',
  date: '2026-11-26',
  title: 'The sign-in page can offer Continue with Google',
  kind: 'feature',
  highlights: [
    'The sign-in page gains a Continue with Google button. It shows once Google sign-in is switched on for the company.',
    'Google opens the account whose email address matches. Your role, your work and your password stay as they are.',
    'A Google address that matches no account is told so. Nobody gets an account by pressing the button.',
    'The email and password form and the emailed sign-in link work as before.',
  ],
}

export default note
