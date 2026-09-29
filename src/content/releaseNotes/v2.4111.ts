import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4111',
  date: '2026-09-28',
  title: 'Jobs → Stages: a row’s buttons are wired once for the board and the follow-up deck',
  kind: 'fix',
  highlights: [
    'Behind the scenes: the move and send-back buttons on a Stages row (Move to Working, Ready to Bill, Bill Customer, Mark Paid, Send back…) are now set up in one place, shared by the board and the follow-up deck, instead of two copies that could drift apart.',
    'Nothing changes on screen: every button does what it did, in both places.',
  ],
}

export default note
