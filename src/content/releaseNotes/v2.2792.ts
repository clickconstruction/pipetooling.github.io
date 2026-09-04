import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2792',
  date: '2026-09-04',
  title: 'GC Review: click a round chip to see that sender\'s round as they see it',
  kind: 'feature',
  highlights: [
    'Every chip in Weekly statement rounds — and the "Malachi 0/2 sent" tally — opens a card with that sender\'s GCs in Start-round order, each with its state.',
    'The card shows how they\'re being prompted: whether their Dashboard row is showing, their round email schedule (or a one-click set-up), and when they last marked a statement sent.',
    'From the card: preview the email exactly as it would land in their inbox, reassign a GC, or undo a mark. Nothing on it sends or marks as them.',
  ],
}

export default note
