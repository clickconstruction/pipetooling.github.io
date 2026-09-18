import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3580',
  date: '2026-09-17',
  title: 'Payroll: Apple Pay sends, and a memo that says "2 of 2 from $1,067.23"',
  kind: 'feature',
  highlights: [
    'When one send pays more than one week, every row it lands on now ends its memo with its part and the whole send — "Apple Pay · 1 of 2 from $1,067.23" — so a $600.06 row is never mistaken for the whole payment. The rule is applied automatically wherever a send is recorded or linked.',
    'Apple Pay joins Cash App, Mercury and client-direct as a way a payment can be marked, and the Payments view shows an Apple Pay chip for it.',
    'An advance created from the leftover of a bigger send says how much of the send it was: "$323.81 of $1,500.00 ahead".',
  ],
}

export default note
