import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3577',
  date: '2026-09-17',
  title: 'Payroll: a Payments view — every payment made, sortable',
  kind: 'feature',
  highlights: [
    'People → Pay → Payroll gains a third pill beside Pay run and Balances: Payments — one row per payment made, across everyone: paid on, person, period, amount, memo, who recorded it, and a Stub link.',
    'Every column header sorts (click again to flip), a window of 30 d · 90 d · this year · all, the name box also matches memo text, and the total under the table is what is showing.',
    'A memo that starts with Cash App, Mercury, check or client wears that word as a chip. Nothing is recorded here — Record payment stays on the Pay run row.',
  ],
}

export default note
