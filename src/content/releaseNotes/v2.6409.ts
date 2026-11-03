import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6409',
  date: '2026-11-03',
  title: 'A bid lost GC by GC reads its reasons from the GC cards and stops asking Add why',
  kind: 'fix',
  highlights: [
    'When every GC card on a lost bid carries a reason, the Lost pile’s Why did we lose? strip now reads those reasons, one line per GC with what they said, instead of asking Add why for a reason you already recorded.',
    'The N need a reason chip, the Bid Tabs badge on Lost, the Why we lost headline, the Lost summary’s red rows and the Dashboard’s lost-bids card all count the same way: a bid lost GC by GC with a reason on every card is explained.',
    'When one GC still owes a reason, the strip names it beside the nudge and keeps the chips. A bid’s own reason, set by hand, still reads first.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'estimator'],
}

export default note
