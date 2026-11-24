import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8426',
  date: '2026-11-23',
  title: 'Bills sent: the payout tile always answers, and a credit marks its day',
  kind: 'fix',
  highlights: [
    'On By day paid, the tile Next Stripe payout to the bank now stays in place. It reads None on its way when Stripe has no payout coming, where before the tile was simply not there.',
    'A day that holds a credit in kind and no money now reads 1 credit. Before, the day was blank, and the Other chip could open a month with nothing to press.',
    'The printed month marks the same day.',
  ],
}

export default note
