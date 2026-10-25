import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5856',
  date: '2026-10-25',
  title: 'The Bridge: the Collect card’s weeks count only the bills past their day',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The Collect card divided every open bill, current ones included, by what customers pay a week. A bill inside its payer’s usual pace is not waiting on Collect yet. The weeks now count only the bills past their day, by each payer’s own pace, the way the Collect desk reads them.',
    'The headline still says what is billed and not yet paid. Under it, the card says how much is past its day and on how many bills, and draws what is not yet due grey. That grey is money, not a guess, so it never makes Collect read thin and never asks for a percent.',
  ],
}

export default note
