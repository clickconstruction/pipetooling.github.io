import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5806',
  date: '2026-10-23',
  title: 'Banking: the Account nicknames window says what each Mercury account is',
  kind: 'feature',
  highlights: [
    'Each Mercury account is a card. The card shows the name Mercury gives the account, its kind and its balance, with Use this name to take that name as the nickname.',
    'Under it, what the ledger holds for the account: how many transactions, the first and last dates, money in and out, the counterparties that recur and the newest lines.',
    'The accounts with no nickname come first, marked. The full id has Copy, and Show in ledger closes the window with the Ledger filtered to that account.',
    'Save, Clear and the empty-box rule are unchanged. Only a dev sees the window.',
  ],
}

export default note
