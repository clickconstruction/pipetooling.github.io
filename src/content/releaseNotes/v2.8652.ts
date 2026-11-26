import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8652',
  date: '2026-11-26',
  title: 'Accounts Receivable: each closed case says what kind of case it is',
  kind: 'fix',
  highlights: [
    'Under Closed cases, a row said who paid, how much and how the case was closed. Nothing said whether it was a check that came back, a card dispute or a check never deposited.',
    'Each row now says its kind on a line of its own, in the same words the Came back list uses.',
    'Reopen… does what it did. Now you can tell which kind of case you are reopening.',
  ],
}

export default note
