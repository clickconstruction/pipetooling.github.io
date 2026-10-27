import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5941',
  date: '2026-10-26',
  title: 'The Legal desk on a phone: the list, then one account',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a phone the Legal desk opens on the list of Collections accounts, the whole width of the screen. Press an account and it opens on its own screen, its six tabs pinned at the top in a row you can swipe. A tab brings its part of the account up under them.',
    'Press ← Accounts, or the phone\'s Back, to return to the list. A link to one account opens that account, and ← Accounts takes you to the list.',
    'The window the desk used to be is gone with its full screen button and ✕. On a computer the desk is the same page as before, the list beside the account.',
  ],
}

export default note
