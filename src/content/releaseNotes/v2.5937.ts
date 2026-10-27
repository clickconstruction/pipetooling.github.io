import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5937',
  date: '2026-10-26',
  title: 'Money in: the week is read, and every dollar sits in one place',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The coming Money in bar now reads the week: payments, checks typed in, deposits pending and posted at the bank, the checks that came back, their word, their pace, open Stripe bills and the next Stripe payout.',
    'A check typed in this week sits in the drawer until the bank has it, never in Came in as well, and a Stripe payout reaching the bank is never counted again.',
    'A deposit meets the payment or the one open bill it pays, so the same money never shows twice.',
    'Nothing shows yet; the bar itself is the next update.',
  ],
}

export default note
