import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6638',
  date: '2026-11-07',
  title: 'Settings → Jobs & billing: each Billing and money card reads its value on its folded row',
  kind: 'feature',
  highlights: [
    'The seven cards under Billing and money now show their live value on the folded row: the rate card’s two main rates, the markup over cost, the two trip charge amounts, the default labor rate, the Job Book’s line count, whether pay by card is on, and the trades’ cut-off in days.',
    'A card not yet set says so in words on its row, such as No rate set yet or At cost, no markup set, so a blank is read without opening the card.',
    'Open a card and its row reads what the card sets again; fold it and the row reads the value you just saved.',
  ],
}

export default note
