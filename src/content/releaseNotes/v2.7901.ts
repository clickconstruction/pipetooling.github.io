import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7901',
  date: '2026-11-19',
  title: 'Attach a login with a password you set',
  kind: 'feature',
  highlights: [
    'A person on the roster with no login could get one only by email. The Attach a login form on their desk now asks how they sign in.',
    'Pick Set a password now, type it twice and press Attach with this password. No email goes out, and you hand the password over yourself.',
    'Email them a link works as before and stays the first choice. Attaching a login is still a dev\'s press.',
  ],
}

export default note
