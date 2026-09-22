import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3693',
  date: '2026-09-21',
  title: 'One send, oldest week first: split a payment across the open weeks',
  kind: 'feature',
  highlights: [
    'Cash App… → Record now has Split oldest first: the send fills the person’s open weeks from the oldest, one payment per week, and every box can be edited before saving. Each payment’s memo carries the Cash App id and reads “2 of 4 from $5,000.00”.',
    'On Balances, the settle-up line’s button opens the same split for any send — amount, date and memo once, one payment per week it reaches. A send larger than the open weeks says what is left over instead of landing on the wrong week.',
    'Recording on one report still works exactly as before; the split is a second button beside it.',
  ],
}

export default note
