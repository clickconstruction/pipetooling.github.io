import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2837',
  date: '2026-09-05',
  title: 'Sign-in doors closed: roster needs a sign-in, invite page cannot reset your password',
  kind: 'fix',
  highlights: [
    'The list of who works here is now readable only after you sign in. Before, anyone holding the app\'s public key could pull names without an account.',
    'Opening the invite page while already signed in now says "You\'re already set up — sign in" with a Sign in button and a "Not you? Sign out" link, instead of showing a password form that would have quietly replaced your current password. A fresh invite from the email still lands on the normal set-password step.',
    'The old self-service "Create an account" page is gone. New people join by invitation from People → Users, the way they already did.',
  ],
}

export default note
