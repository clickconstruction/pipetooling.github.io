import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3043',
  date: '2026-09-07',
  title: 'Safety net under checklist cost estimates',
  kind: 'fix',
  highlights: [
    'The cost estimates and recorded actuals on checklist tasks now have 5 tests pinning how they load once, save, clear and announce changes to every open chip; no behaviour change.',
  ],
}

export default note
