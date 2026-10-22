import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5724',
  date: '2026-10-22',
  title: 'Sign-in: the dev login and Log in as find every account',
  kind: 'fix',
  highlights: [
    'The password-free dev login and Settings → Log in as looked only at the first 50 accounts. The company has exactly 50, so the next account made would have hidden one of them, and that person’s sign-in through either door would have said “User not found”.',
    'Both doors now read every page of accounts, so a new hire or a test account can never push a real one out of sight.',
  ],
}

export default note
