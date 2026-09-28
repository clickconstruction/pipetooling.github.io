import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4073',
  date: '2026-09-28',
  title: 'Jobs → Stages: the billed-money figures load from their own piece',
  kind: 'fix',
  highlights: [
    'Behind the scenes: the customer pay speeds, promised pay dates, promise records and payment-chase call log that Billed Awaiting Payment uses now load from one shared piece instead of inside the Stages page.',
    'Nothing changes on screen: the same people see the same figures, and a figure that cannot load still just stays hidden.',
  ],
}

export default note
