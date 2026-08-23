import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2152',
  date: '2026-08-23',
  kind: 'fix',
  title: 'Partnerships fits on a phone',
  highlights: [
    'The partnership card no longer runs off the right edge of a phone — the Ledger tab and the Balance column are back on screen.',
    'The tab strip keeps the selected tab in view and fades at the edge when there are more tabs to scroll to.',
    'On phones the Ledger shows each posting as a two-line row — date and posting on the left, amount over running balance on the right — with short dates (Aug 15) and a › on every row you can tap for details. Desktop keeps the table.',
  ],
}

export default note
