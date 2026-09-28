import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3991',
  date: '2026-09-28',
  title: 'GC Review: the pay date on a word goes on the GC’s bills',
  kind: 'feature',
  highlights: [
    'A pay date saved with a GC’s word is now a real promise on the bills that GC owes — the same record as “They said…” on the Billed row. The chip turns green on the Stages board and the payment forecast moves with it. Before, the date stayed inside GC Review.',
    'The date is asked right under the temperature, with the usual answers one tap away: this Friday, next Friday, the end of the month, or “Still Oct 9” when they gave a date before.',
    'The date covers every bill the GC owes unless you untick some under Choose bills. The form says before you save how many bills had a different date, and leaves alone the ones already on that date.',
    'A line above the form shows what the GC said last time, in red once that date has passed with money still owed. The call sheet files its dates the same way.',
  ],
}

export default note
