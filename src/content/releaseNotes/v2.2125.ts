import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2125',
  date: '2026-08-22',
  title: 'Partner ledger: the two ends of the week now add up',
  kind: 'fix',
  highlights: [
    'Week opened and Week closed are now signed and colored — red with a minus when you owe Click, green with a plus when Click owes you — with the words still underneath. Before, a week that flipped sides read like two similar positive numbers with a plus line between them that didn\'t connect.',
    'When a week\'s running balance crosses $0, a small note appears on the line where it happened: "crossed $0 — cleared the $546.39 you owed and went $60.25 ahead." Ordinary weeks look the same as before.',
    'The printed statement and the Full ledger already used this convention; the card now matches them.',
  ],
}

export default note
