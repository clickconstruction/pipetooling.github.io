import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2236',
  date: '2026-08-24',
  title: 'Paid bills keep their billed date',
  kind: 'fix',
  highlights: [
    'Marking a bill paid no longer erases the record of when it was billed — that erasure was starving the pay-speed history behind the Payment forecast.',
    'With the date preserved, every paid bill now counts toward its customer’s "pays in ~N days" speed instead of vanishing from the math.',
  ],
}

export default note
